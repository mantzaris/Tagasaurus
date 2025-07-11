<script lang="ts">
import { getContext, onMount, tick } from 'svelte';
import { Button, Col, Container, Icon, Input, Modal, ModalBody, ModalFooter, ModalHeader, Row } from '@sveltestrap/sveltestrap';
import type { SearchRow } from '$lib/types/general-types';
import StreamResultCard from '$lib/components/StreamResultCard.svelte';
import { facesSetUp, detectFacesInImage, embedFace } from '$lib/utils/faces';
import { boxDistance } from '$lib/utils/ml-utils';

const optionLabels = ["none", "camera", "screen"];

interface DesktopSource {
  type: "screen";
  id: string;
  name: string;
  display_id: string;
}

interface CameraSource {
  type: "camera";
  deviceId: string;
  label: string;
}

interface RawDesktopSource {
  id: string;
  name: string;
  display_id: string;
}


type SourceObject = DesktopSource | CameraSource;

let mediaDir: string = $state( getContext('mediaDir') );

let videoEl: HTMLVideoElement | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let isPaused = $state(false);
let hasStream = $state(false);
const placeholderUrl = new URL('./Taga.png', import.meta.url).href;
let testRows = $state<SearchRow[]>([]);

type SourceOption = "none"|"screen"|"camera";
type ModalSourceSelect = { type: SourceOption, source_options: string[] }
type ModalSourceSource = null | { type: SourceOption, label?: string, deviceId?: string, id?: string, display_id?: string, name?: string }

let sourceSelected: SourceOption = $state('none');
let selectModalOptions = $state<ModalSourceSelect>({type: 'none', source_options: []});
let newSelectedSource = $state<ModalSourceSource>(null);
let lastListed: SourceObject[] = [];
let newDeviceIndex = $state<null | number>(null);

let detectionInterval = $state(1000);
let detectedFaces = $state<{id: number; box: number[]}[]>([]);
let lastTrackedBox = $state<number[] | null>(null); // [x1, y1, x2, y2] or null
let lastResetTime = $state<number>(0); //timestamp of last reset
let isFixed = $state(false);
let lastDrawnBox = $state<number[] | null>(null);


$effect(() => {
    handleSourceSelect(sourceSelected);
});

let webcams: string[] = []; //TODO: remove?
let desktopSources: string[] = []; //TODO: remove?

let wayland = false; //TODO: handle!


onMount(async () => {
    try {        
      const setupSuccess = await facesSetUp();

      if (!setupSuccess) {
          console.error('Failed to set up face detection');
      }
    } catch (err) {
        console.error('Webcam access refused:', err);
    }
});


function handleSourceSelect(input: SourceOption) {
  if (wayland) return;            // TODO: handle that later

  if (input === "camera") {
    getCameraSources();
  } else if (input === "screen") {
    getScreenSources();
  } else {
    // user picked none
    newSelectedSource = null;     // clears the other effect
    stopStream();                 // really stop the stream
  }
}


async function getScreenSources() {
  const raw: RawDesktopSource[] = await window.bridge.listDesktopSources();

  const screenSources: DesktopSource[] = raw.map(
    (s: RawDesktopSource): DesktopSource => ({
      type: "screen",
      id: s.id,
      name: s.name,
      display_id: s.display_id,
    })
  );

  lastListed = screenSources;

  selectModalOptions = {
    type: "screen",
    source_options: screenSources.map(src => src.name),
  };
  toggleSelectModal();
}

async function getCameraSources() {
  const raw = await window.bridge.listMediaDevices();

  const cameraSources: CameraSource[] = raw
    .filter((d: any) => d.kind === "videoinput")
    .map(
      (d): CameraSource => ({
        type: "camera",
        label: d.label,
        deviceId: d.deviceId
      })
    );

  lastListed = cameraSources;

  selectModalOptions = {
    type: "camera",
    source_options: cameraSources.map(cam => cam.label)
  };
  toggleSelectModal();
}

let open = $state(false);
const toggleSelectModal = () => (open = !open);

function closeModal(ok: boolean) {
  open = false;

  if (ok && newDeviceIndex !== null) {
    newSelectedSource = lastListed[newDeviceIndex] ?? null;
  } else {
    sourceSelected = "none";
    newSelectedSource = null;
  }
  newDeviceIndex = null;
}

let currentStream: MediaStream | null = null;


$effect(() => {
  handleSourceSelection(newSelectedSource);   // synchronous call
});

async function handleSourceSelection(src: ModalSourceSource) {
  if (!src) {
    stopStream();
    return;
  }

  try {
    if (src.type === "camera" && src.deviceId) {
      await startCamera(src.deviceId);
    }

    if (src.type === "screen" && src.id) {
      await startDesktop(src.id);
    }
  } catch (err) {
    console.error("Stream failed:", err);
    stopStream();
  }
}

async function startCamera(deviceId: string) {
  stopStream();
  currentStream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: deviceId } },
    audio: false,
  });
  attachStream(currentStream);
}

async function startDesktop(sourceId: string) {
  stopStream();
  const constraints: any = {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: sourceId,
      },
    },
  };
  currentStream = await navigator.mediaDevices.getUserMedia(constraints);
  attachStream(currentStream);
}

async function attachStream(stream: MediaStream) {
  hasStream = true;
  isPaused  = false;
  await tick(); 

  if (videoEl) {
    videoEl.srcObject = stream;
    videoEl.play();

    videoEl.onloadedmetadata = async () => {
        if (canvasEl && videoEl) {
            canvasEl.width = videoEl.videoWidth;
            canvasEl.height = videoEl.videoHeight;
        }

        try {
            const startTime = performance.now();
            const testImg = await captureFrame();
            await detectFacesInImage(testImg); //just detect (no draw/embedding needed)
            const endTime = performance.now();
            const detectionTime = endTime - startTime;

            if (detectionTime > 1000) {
                const scaled = Math.min(3000, detectionTime * 1.5);
                detectionInterval = Math.round(scaled / 100) * 100; //slow
            } else if (detectionTime > 500) {
                const scaled = Math.min(2000, detectionTime * 1.5);
                detectionInterval = Math.round(scaled / 100) * 100; //medium
            } else {
                const scaled = Math.min(1000, detectionTime * 1.5);
                detectionInterval = Math.round(scaled / 100) * 100; //fast
            }
            console.log(`Detection time: ${detectionTime}ms. Set interval to ${detectionInterval}ms.`);
        } catch (err) {
            console.error('Benchmark failed:', err);
            detectionInterval = 1000; //fallback to default
        }
    };
  }
}

function stopStream() {
  currentStream?.getTracks().forEach(t => t.stop());
  currentStream = null;
  hasStream = false;
  isPaused  = false;
  if (videoEl) videoEl.srcObject = null;   // clears frame
}

function togglePause() {
  if (!hasStream || !videoEl) return;   // defensive guard

  if (isPaused) {
    videoEl.play();
    isPaused = false;
  } else {
    videoEl.pause();
    isPaused = true;
  }
}


// capture the current video frame as an HTMLImageElement
async function captureFrame(): Promise<HTMLImageElement> {
    if (!videoEl) throw new Error('No video element');

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoEl.videoWidth;
    tempCanvas.height = videoEl.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
        tempCtx.drawImage(videoEl, 0, 0, tempCanvas.width, tempCanvas.height);
    }

    const img = new Image();
    img.src = tempCanvas.toDataURL('image/png');
    await new Promise(resolve => { img.onload = resolve; });
    return img;
}


let isEmbedding = $state(false);

// detect faces in the image and draw a bounding box for a random face (or clear if none)
async function detectAndDraw(img: HTMLImageElement): Promise<void> {
    if (!canvasEl) return;

    detectedFaces = await detectFacesInImage(img);

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height); //always clear

    //no faces: reset state and bail
    if (detectedFaces.length === 0) {
      isFixed = false;
      lastTrackedBox = lastDrawnBox = null;
      lastResetTime = 0;
      return;
    }

    const face = pickFace();
    const [x1, y1, x2, y2] = face.box;

    ctx.strokeStyle = isFixed ? 'green' : 'blue';
    ctx.lineWidth = 6;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

    if (!isFixed) lastResetTime = Date.now();               // used for timeouts
    lastTrackedBox = face.box;
    lastDrawnBox   = face.box;

    //compute embedding only when we actually switch faces
    await maybeEmbed(face.id);
}

// setup interval to capture, detect, and draw every second
$effect(() => {
    if (!hasStream || !videoEl || !canvasEl) return;

    const interval = setInterval(async () => {
        try {
            const img = await captureFrame();
            await detectAndDraw(img);
        } catch (err) {
            console.error('Face detection error:', err);
        }
    }, detectionInterval);

    return () => clearInterval(interval);
});


//effect for canvas click handler
const handleCanvasClick = async (event: MouseEvent) => {
  if (!canvasEl || detectedFaces.length === 0) {
    return;
  }

  if(!canvasEl) return;

  //click point in DISPLAY space
  const rect = canvasEl.getBoundingClientRect();
  const dx   = event.clientX - rect.left;
  const dy   = event.clientY - rect.top;

  //convert each face centre to DISPLAY space & keep the nearest
  const toDisplay = ([x1, y1, x2, y2]: number[]) => ({
    cx: ((x1 + x2) / 2) * rect.width  / canvasEl!.width,
    cy: ((y1 + y2) / 2) * rect.height / canvasEl!.height,
  });

  let bestFace: { id: number; box: number[] } | null = null;
  let bestDist = Infinity;

  for (const f of detectedFaces) {
    const { cx, cy } = toDisplay(f.box);
    const dist = Math.hypot(dx - cx, dy - cy);
    if (dist < bestDist) {
      bestDist = dist;
      bestFace = f;
    }
  }

  if (!bestFace) return;           

  //toggle lock and compute embedding every time we LOCK
  isFixed        = !isFixed;
  lastTrackedBox = bestFace.box;
  // console.log('[click]', isFixed ? 'LOCKED' : 'UNLOCKED', 'face', bestFace.id);

  if (isFixed) maybeEmbed(bestFace.id);

  //immediate visual feedback
  try {
    const img = await captureFrame();
    await detectAndDraw(img);   // green when locked, blue when not
  } catch (err) {
    console.error('[click] redraw failed:', err);
  }
};


const TRACK_MS    = 3000;  // ms  keep same face while unlocked
const MOVE_THRESH = 250;   // px  tolerate this drift in blue mode
const LOST_THRESH = 500;   // px  consider the face lost when locked

function pickFace(): { id: number; box: number[] } {
  const now = Date.now();

  /* A.  LOCKED (green) – glide with same person */
  if (isFixed && lastTrackedBox) {
    let best = detectedFaces[0];
    let dist = boxDistance(lastTrackedBox, best.box);
    for (const f of detectedFaces) {
      const d = boxDistance(lastTrackedBox, f.box);
      if (d < dist) { best = f; dist = d; }
    }

    /* ─── ❶  Bail-out if too far ───────────────────────────────────────── */
    if (dist > LOST_THRESH) {
      console.log('[track] lost face (', dist.toFixed(0), 'px ) → unlock');
      isFixed = false;                       // drop back to blue mode
      // no return; let code continue into branch B on this same call
    } else {
      lastTrackedBox = best.box;             // keep gliding
      return { id: -1, box: best.box };      // -1 → skip embedding
    }
  }

  /* B.  UNLOCKED (blue) – keep tracking for TRACK_MS or MOVE_THRESH */
  if (lastTrackedBox && now - lastResetTime < TRACK_MS) {
    let best = detectedFaces[0];
    let dist = boxDistance(lastTrackedBox, best.box);
    for (const f of detectedFaces) {
      const d = boxDistance(lastTrackedBox, f.box);
      if (d < dist) { best = f; dist = d; }
    }
    if (dist < MOVE_THRESH) {
      lastTrackedBox = best.box;
      lastResetTime  = now;                  // refresh window
      return best;                           // keeps blue stroke
    }
    // else: drift too far → fall through to reset
  }

  /* C.  Need a fresh target */
  const idx  = Math.floor(Math.random() * detectedFaces.length);
  const face = detectedFaces[idx];
  lastTrackedBox = face.box;
  lastResetTime  = now;
  return face;                               // triggers new embedding
}




async function maybeEmbed(faceId: number) {
  if (faceId < 0 || isEmbedding) return;          // -1 means same face
  isEmbedding = true;
  try {
    const embedding = await embedFace(faceId);
    if (embedding) {
      console.log('Tracked face embedding:', embedding.slice(0, 10));
      //  testRows = await searchWithEmbedding(embedding);
    }
  } catch (err) {
    console.error('Embedding error:', err);
  } finally {
    isEmbedding = false;
  }
}

</script>


<Modal isOpen={open} toggle={toggleSelectModal} scrollable={true}>
    <ModalHeader toggle={toggleSelectModal}>Select Source</ModalHeader>
    <ModalBody>
        {#each selectModalOptions.source_options as label, idx}
            <Input type="radio" value={idx} label={label} bind:group={newDeviceIndex} />
        {/each}
    </ModalBody>
    <ModalFooter>
      <Button color="primary" on:click={()=>closeModal(true)}>Ok</Button>
      <Button color="secondary" on:click={()=>closeModal(false)}>Cancel</Button>
    </ModalFooter>
</Modal>



<Container fluid class="vh-100 d-flex p-2 gap-3 no-scroll" style="background-color: purple;">

<div class="d-flex flex-column flex-grow-1" style="flex-basis:75%; min-width:0; min-height:0; background-color: aqua;">
    <!-- Control Buttons -->
    <div class="flex-shrink-0 border p-1 util-controlbar" style="background-color: yellow;">

        <!-- Extra‑small screens ( <576 px ) -->
        <div class="d-block d-lg-none h-100">
            <Row class="h-100 align-items-center ">
                <Col xs="auto" class="d-flex justify-content-start">
                    <Button color="primary" size="sm" href="/">
                        <Icon name="house-fill" class="fs-6"/>
                    </Button>
                </Col>
                <Col class="d-flex justify-content-center   ">
                    <Input type="select" class="w-50 ms-1 me-2" bind:value={sourceSelected}>
                    {#each optionLabels as option}
                        <option value={option} class="fs-6">{option}</option>
                    {/each}
                    </Input>
                </Col>
                <Col xs="auto" class="d-flex justify-content-end">
                    {#if hasStream}
                        <Button color="primary" size="sm" onclick={togglePause} >
                            {#if isPaused}
                            <Icon name="play"  class="fs-6" />
                            {:else}
                            <Icon name="pause" class="fs-6" />
                            {/if}
                        </Button>
                    {/if}
                </Col>
            </Row>
        </div>

        <!-- Small and up ( >=576 px ) -->
        <div class="d-none d-lg-block h-100">
            <Row class="h-100 align-items-center gx-3">
                <Col xs="auto" class="d-flex justify-content-start">
                    <Button color="primary" size="md" href="/">
                        <Icon name="house-fill" class="fs-3"/>
                    </Button>
                </Col>
                <Col class="d-flex justify-content-center  ">
                    <Input type="select" class=" w-50   ms-2 me-2 fs-3" bind:value={sourceSelected}>
                    {#each optionLabels as option}
                        <option value={option}>{option}</option>
                    {/each}
                    </Input>
                </Col>
                <Col xs="auto" class="d-flex justify-content-end">
                    {#if hasStream}
                        <Button color="primary" size="sm" onclick={togglePause} >
                            {#if isPaused}
                            <Icon name="play"  class="fs-3" />
                            {:else}
                            <Icon name="pause" class="fs-3" />
                            {/if}
                        </Button>
                    {/if}
                </Col>
            </Row>
        </div>

    </div>

    <!-- Stream Display -->
    <div class="flex-fill border p-1 overflow-auto" style="min-height:0; ">
      <!-- VideoCapture  -->
       <div class="capture-wrapper">
        {#if hasStream}
          <!-- svelte-ignore a11y_media_has_caption -->
          <video bind:this={videoEl} class="capture-object" autoplay playsinline></video>
          <canvas onclick={handleCanvasClick} bind:this={canvasEl} class="capture-object"></canvas>
        {:else}
          <!-- Placeholder image for dev / no‑camera situations -->
          <img src={placeholderUrl} alt="dev placeholder" class="capture-object" />
        {/if}
      </div>
    </div>
  
</div>

<!-- search results -->
<div class="flex-grow-1 border p-1 overflow-auto" style="flex-basis:25%; min-width:0; min-height:0; background-color: blue;">
    <!-- <Container fluid class="h-100 mt-2" style="background-color:bisque"> -->
        
            {#each testRows as row }
                
                <StreamResultCard  />
            
            {/each}        
    <!-- </Container> -->
</div>


</Container>

<style>
    .capture-wrapper {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .capture-object {
        width: 100%;
        height: 100%;
        object-fit: contain; /* keep aspect ratio, touch at least one axis */
        

    }
    canvas.capture-object {
        position: absolute;
        top: 0;
        left: 0;
        /*pointer-events: none;*/
        cursor: pointer;
        pointer-events: auto;
    }

    @property --controlbar-h {
        syntax: "<length-percentage>";
        inherits: false;
        initial-value: 3rem;
    }

    .util-controlbar {
        --controlbar-h: clamp(3rem, 10vh, 5.5rem);
        height: var(--controlbar-h);
        min-height: var(--controlbar-h);
    }



</style>