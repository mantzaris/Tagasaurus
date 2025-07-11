<script lang="ts">
import { getContext, onMount, tick } from 'svelte';
import { Button, Col, Container, Icon, Input, Modal, ModalBody, ModalFooter, ModalHeader, Row } from '@sveltestrap/sveltestrap';
import type { SearchRow } from '$lib/types/general-types';
import StreamResultCard from '$lib/components/StreamResultCard.svelte';

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

$effect(() => {
    handleSourceSelect(sourceSelected);
});

let webcams: string[] = [];
let desktopSources: string[] = [];

let wayland = false;


onMount(async () => {
    try {        
    
    } catch (err) {
        console.error('Webcam access refused:', err);
    }
});


function handleSourceSelect(input: SourceOption) {
  if (wayland) return;            // you said you’ll handle that later

  if (input === "camera") {
    getCameraSources();
  } else if (input === "screen") {
    getScreenSources();
  } else {
    /* <-- user picked “none” */
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
          <canvas bind:this={canvasEl} class="capture-object"></canvas>
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
        pointer-events: none; /* overlay, no mouse capture */
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