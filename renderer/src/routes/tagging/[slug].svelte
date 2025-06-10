<script lang="ts">
import { Container, Row, Col, Button, Input, Icon, Image, Modal, ModalBody, ModalHeader, ModalFooter, Accordion, AccordionItem, Figure, Tooltip } from '@sveltestrap/sveltestrap';
import { params } from '@roxi/routify';

import MediaView from '$lib/MediaView.svelte';
import { getContext, onMount } from 'svelte';
import { getMediaFile, getRandomMediaFile, getTotalMediaFileCount, removeMediaFileSequential } from '$lib/utils/temp-mediafiles';
import type { DeviceGPU, MediaFile, SearchRow } from '$lib/types/general-types';
import { getMediaDir } from '$lib/utils/localStorageManager';
import { snapshotVideo, boxToThumb, getMediaFilePath } from '$lib/utils/utils';

import {embedText} from '$lib/utils/text-embeddings';
import {facesSetUp, detectFacesInImage, embedFace, scaleFaceBox, make112Face} from '$lib/utils/faces';
  import SearchResultCard from '$lib/components/SearchResultCard.svelte';


const device = getContext<DeviceGPU>('gpuDevice') ?? 'wasm';

let { slug } = $params; //hash

let mediaDir: string = $state( getContext('mediaDir') );
let mediaFile: MediaFile | undefined = $state(undefined);
let seenMediaFiles: MediaFile[] = $state([]);

let mode: "edit" | "gallery" = $state("edit");
let openSearch = $state(false);

let searchInputId = $state(1);
let accordionOpen = $state(true);
let searchAllowFaces = $state(false);
let faces:any = $state([]); //{ id: 1, src: 'https://picsum.photos/andom=1', selected: false },
let searchProcessing = $state(false);
let searchText = $state('');

let searchRowResults: SearchRow[] =  $state([]);

let askDelete = $state(false);

let isProcessing = $state(false);
let canSave = $state(true);

onMount(async () => {
  isProcessing = true;

  // console.log(`text embedding will use of gpu: ${device}`);

  try {
    mediaDir = await getMediaDir();
    if(!slug) {
      mediaFile = await getRandomMediaFile(true);
    } else {
      mediaFile = await getMediaFile(slug, true);
    }

    if(!mediaFile) {
      window.location.href = "/tagging"
    } else {
      seenMediaFiles.push(mediaFile);
      await removeMediaFileSequential(mediaFile.fileHash);
    }
  } catch (error) {
    console.error("Error during media retrieval:", error);
    window.location.href = "/tagging"; //$goto('/tagging');
  }
  console.log('before facesSetup')
  await facesSetUp(); //~0.6seconds
  

  isProcessing = false;
});

async function nextMediaFile() {
  faces = [];
  searchRowResults = [];
  searchAllowFaces = false;

  try {
    mediaFile = await getRandomMediaFile(true);
    // console.log('nextMediaFile: mediaFile', $state.snapshot(mediaFile));

    if (mediaFile) {
      const { fileHash } = mediaFile; 
      if (!seenMediaFiles.some(m => m.fileHash === fileHash)) {
         seenMediaFiles.push(mediaFile);
      }

      // console.log('nextMediaFile: seenMediaFiles', $state.snapshot(seenMediaFiles));

      if (seenMediaFiles.length > 400) {
        seenMediaFiles.shift();
      }

      await removeMediaFileSequential(mediaFile.fileHash);
    } else {
      window.location.href = "/tagging"; //$goto('/tagging');
    }
  } catch (error) {
    console.error("Error in nextMediaFile:", error);
    window.location.href = "/tagging" //$goto('/tagging');
  }
}

async function prevMediaFile() {
  faces = [];
  searchRowResults = [];
  searchAllowFaces = false;

  try {
    if (!mediaFile) {
      console.warn("No current media file is set.");
      window.location.href = "/tagging"; //$goto('/tagging');
      return;
    }

    const currentIndex = seenMediaFiles.findIndex(
      (m) => m.fileHash === mediaFile?.fileHash
    );

    if (currentIndex > 0) {
      mediaFile = seenMediaFiles[currentIndex - 1];
    } else {
      console.info("Current media file is already the first entry; no previous file exists.");
    }
  } catch (error) {
    console.error("Error in prevMediaFile:", error);
    window.location.href = "/tagging"; //$goto('/tagging');
  }
}

function openDeleteModal() {
  askDelete = true;
}
function closeDeleteModal() {
  askDelete = false;
}
async function confirmDelete() {
  askDelete = false;
  isProcessing = true;

  if(mediaFile) {
    //frontend
    seenMediaFiles = seenMediaFiles.filter(file => file.fileHash !== mediaFile?.fileHash);
    await removeMediaFileSequential(mediaFile.fileHash);
    //backend
    window.bridge.deleteMediaFile(mediaFile?.fileHash);
  }

  const freshCount = await getTotalMediaFileCount();
  if( freshCount <= 0 ) {
    window.location.href = "/tagging";
  }

  isProcessing = false;
  nextMediaFile();
}

async function saveDescription() {
  if (!mediaFile) return;

  canSave = false;
  isProcessing = true;
  
  try {
    const vec32 = (await embedText(mediaFile.description, device))[0]; //F32 array (384)
    //const [vec32] = await embedText(mediaFile.description, device);
    console.log(vec32);

    const idx = seenMediaFiles.findIndex(
      m => m.fileHash === mediaFile?.fileHash
    );

    if (idx !== -1) {
      seenMediaFiles[idx].description = mediaFile.description;
      seenMediaFiles[idx].descriptionEmbedding = Array.from(vec32);
    }

    window.bridge.saveMediaFileDescription(
      mediaFile.fileHash,
      mediaFile.description,
      vec32
    );

    await removeMediaFileSequential(mediaFile.fileHash)
  } finally {
    setTimeout(() => canSave = true, 500);
    isProcessing = false;
  }
}


const toggleSearch = async () => {
  if (searchProcessing) return;
  openSearch = !openSearch;

  if(faces.length == 0 && openSearch && mediaFile?.fileType.startsWith('image/')) {
    await searchFaceThumbnails();
  }

  if(openSearch && mediaFile?.fileType.startsWith('video/')) {
    await searchFaceThumbnails();    
  }
};

async function searchFaceThumbnails() {

  if(mediaFile?.fileType.startsWith('image/')) {
    const img = document.getElementById('viewing-image-id') as HTMLImageElement;
    const detections = await detectFacesInImage(img);

    if(detections.length > 0) searchAllowFaces = true;

    // Generate aligned 112x112 faces instead of bounding box crops
    const alignedFaces = [];
    for (let i = 0; i < detections.length; i++) {
      const { boxBigger, kpsBigger } = scaleFaceBox(img, detections[i].box, detections[i].kps);
      const cv112 = make112Face(kpsBigger, img);
      alignedFaces.push({
        ...detections[i],
        src: cv112.toDataURL(),  // using aligned face instead of boxToThumb: boxToThumb(img, detection.box),
        selected: false
      });
    }
    faces = alignedFaces;
  }

  if (mediaFile?.fileType.startsWith('video/')) {
    const vid = document.getElementById('viewing-video-id') as HTMLVideoElement;

    // make sure we have at least one decoded frame
    if (vid.readyState < 2) await vid.play();         // kick decode
    const img = await snapshotVideo(vid);

    const detections = await detectFacesInImage(img);

    if(detections.length > 0) searchAllowFaces = true;

    // Generate aligned 112x112 faces instead of bounding box crops
    const alignedFaces = [];
    for (let i = 0; i < detections.length; i++) {
      const { boxBigger, kpsBigger } = scaleFaceBox(img, detections[i].box, detections[i].kps);
      const cv112 = make112Face(kpsBigger, img);
      alignedFaces.push({
        ...detections[i],
        src: cv112.toDataURL(),  // using aligned face instead of boxToThumb
        selected: false
      });
    }
    faces = alignedFaces;
  }
    
  console.log('process face thumbnails');
}

const toggleSearchAccordion = (...args: any[]) => {
  // console.log('toggle', ...args);  
};

function toggleFace(i: number) {
  faces[i] = {
    ...faces[i],
    selected: !faces[i].selected
  };
  faces = [...faces];
}

async function search() {

  const text = searchText.trim();
  const selectedCount = faces.filter((f: { selected: boolean }) => f.selected).length;
  
  if (text.length == 0 && selectedCount == 0) return;

  isProcessing = true;
  searchProcessing = true;

  try {
    const faceInds: number[] = [];
    let faceEmbeddings: Float32Array[] = [];
    let textEmbedding: Float32Array = new Float32Array(0);

    for (const [i, face] of faces.entries()) {
      if (face.selected) faceInds.push(i);
    }

    if(faceInds.length > 0) {
      for (const id of faceInds) {
        const emb = await embedFace(id);
        if (emb) faceEmbeddings.push(emb);
      }
    }

    if(text.length > 0) {
      textEmbedding = (await embedText(text, device))[0];
    }
    
    faceEmbeddings.forEach((emb, i) => console.log(`face[${i}] (first 8):`, Array.from(emb.slice(0, 8))) );
    console.log('text embedding (first 8):', Array.from(textEmbedding.slice(0, 8)) );

    const textVecs = text.length ? [textEmbedding] : [];
    const faceVecs = faceEmbeddings; //.slice(0, 1); // keep only the first  

    const searchRows: SearchRow[] = await window.bridge.searchEmbeddings( textVecs, faceVecs, 100 );
    searchRowResults = [];
    searchRowResults = searchRows.map(r => ({ ...r })); 
    console.log(`SEARCH searchRows = `, searchRows);

    /* do the expensive work (API call, embedding, etc.) */

    isProcessing = false;
    searchProcessing = false;
  } catch {
    isProcessing = false;
    searchProcessing = false;
  } finally {
    isProcessing = false;
    searchProcessing = false;
  }
}

async function searchSelected(row: SearchRow) {
  mediaFile = (await window.bridge.getMediaFilesByHash( [row.fileHash] ))[0];
  openSearch = false;
}

</script>

<div>
  <Modal isOpen={askDelete} toggle={closeDeleteModal} size={'lg'}>
    <ModalHeader toggle={closeDeleteModal}>Verify Delete</ModalHeader>
    <ModalBody>
      Delete this Media File forever?
    </ModalBody>
    <ModalFooter>
      <Button color="primary" onclick={confirmDelete} >Delete</Button>
      <Button color="secondary" onclick={closeDeleteModal} >Cancel</Button>
    </ModalFooter>
  </Modal>
</div>
 
<Container fluid class="d-flex flex-column vh-100 p-2 m-0 .min-vh-0" style="min-height: 0;" >
  <!-- <MyComponent name="Tester" /> -->
  <!-- Layout for extra-small screens -->
  <div class="d-block d-sm-none">
    <!-- Top row: Back and Delete -->
    <Row class="mb-1 align-items-center">
      <Col xs="6" class="d-flex justify-content-start">
        <Button color="primary" size="sm" href="/"><Icon name="house-fill" class="fs-6"/></Button>

        <Input disabled={isProcessing} type="select" class="w-auto ms-1 me-2" bind:value={mode}>
          {#each ["edit", "gallery"] as option}
            <option value={option} class="fs-6">{option}</option>
          {/each}
        </Input>
      </Col>
      <Col xs="6" class="d-flex justify-content-end">
        <Button disabled={isProcessing} onclick={openDeleteModal} id="btn-delete-sm" color="danger" size="sm"><Icon name="x-square-fill" class="fs-6"/></Button>
        <Tooltip target="btn-delete-sm" placement="bottom">Delete</Tooltip>
      </Col>
    </Row>
    <!-- Bottom row: Center group -->
    <Row class="mb-2">
      <Col class="d-flex justify-content-center gap-2">
        <Button disabled={isProcessing} onclick={prevMediaFile} color="primary" size="sm"><Icon name="caret-left-fill" class="fs-6"/></Button>
        <Button disabled={isProcessing} color="primary" size="sm" on:click={toggleSearch}><Icon name="search" class="fs-6"/></Button>
        <Button disabled={isProcessing} onclick={nextMediaFile} color="primary" size="sm"><Icon name="caret-right-fill" class="fs-6"/></Button>
      </Col>
    </Row>
  </div>

  <!-- Layout for small screens and up -->
  <div class="d-none d-sm-block">
    <Row class="mb-2 align-items-center">
      <Col xs="4" class="d-flex justify-content-start">
        <Button color="primary" size="md" href="/"><Icon name="house-fill" class="fs-3"/></Button>
        
        <Input disabled={isProcessing} type="select" class="w-auto ms-2 me-2" bind:value={mode}>
          {#each ["edit", "gallery"] as option}
            <option value={option}>{option}</option>
          {/each}
        </Input>

      </Col>
      <Col xs="4" class="d-flex justify-content-center gap-3">
        <Button disabled={isProcessing} onclick={prevMediaFile} color="primary" size="md"><Icon name="caret-left-fill" class="fs-3"/></Button>
        <Button disabled={isProcessing} color="primary" size="md" on:click={toggleSearch}><Icon name="search" class="fs-3"/></Button>
        <Button disabled={isProcessing} onclick={nextMediaFile} color="primary" size="md"><Icon name="caret-right-fill" class="fs-3"/></Button>
      </Col>
      <Col xs="4" class="d-flex justify-content-end">
        <Button disabled={isProcessing} onclick={openDeleteModal} id="btn-delete-md" color="danger" size="md"><Icon name="x-square-fill" class="fs-3"/></Button>
        <Tooltip target="btn-delete-md" placement="bottom">Delete</Tooltip>
      </Col>
    </Row>
  </div>



  {#if mode === "edit"}  <!-- Edit Mode:description and media view -->
    <Row  style="flex: 1;">
      <!-- Left column: description and save button -->
      <Col xs="12" class="p-2 d-flex flex-column justify-content-center d-block d-sm-none"> <!-- hide >= sm -->
        
        {#if mediaFile}
          <textarea class="form-control mb-1 h-75 fs-6" placeholder="description…" bind:value={mediaFile.description}></textarea>
        {/if}

        <Button id="btn-save-xs" color="success" size="sm" class="mybtn" disabled={!canSave || isProcessing} onclick={saveDescription} >
          <Icon name="save-fill"/>
        </Button>
        <Tooltip target="btn-save-xs" placement="top">Save</Tooltip>
      </Col>

      <Col sm="4" lg="4" class="p-3 d-flex flex-column justify-content-center d-none d-sm-flex"> <!-- hide on xs -->
        
        {#if mediaFile}
          <textarea class="form-control mb-2 h-75 fs-5" placeholder="description…" bind:value={mediaFile.description}></textarea>
        {/if}

        <Button id="btn-save-sm" color="success" size="lg" class="mybtn" disabled={!canSave || isProcessing} onclick={saveDescription}>
          <Icon name="save-fill"/>
        </Button>
        <Tooltip target="btn-save-sm" placement="top">Save</Tooltip>
      </Col>  

      <Col xs="12" sm="8" lg="8" class="d-flex flex-column p-3 image-col" style="min-height:40vh !important; ">
        
        {#if mediaFile}
          <MediaView imageUrl={getMediaFilePath(mediaDir,mediaFile.fileHash)} fileType={mediaFile.fileType}/>
        {:else}
          Not Found
        {/if}
      
      </Col>
    </Row>
  {:else if mode === "gallery"} <!-- only media view, no description -->
    <div style="flex: 1;">
      
      {#if mediaFile}
        <MediaView imageUrl={getMediaFilePath(mediaDir,mediaFile.fileHash)} fileType={mediaFile.fileType}/>
      {:else}
        Not Found
      {/if}
    
    </div>
  {/if}

  <Modal isOpen={openSearch} toggle={toggleSearch} backdrop={searchProcessing ? 'static' : true} keyboard={!searchProcessing} scrollable size={"xl"}>
    <!-- <ModalHeader toggle={toggleSearch}>Modal title</ModalHeader> -->
    
    <ModalBody>

      <Accordion on:toggle={toggleSearchAccordion} class="mb-2">
        <AccordionItem
          active
          header="Text Search"
          on:toggle={(e) => {
            searchInputId = 1;
            accordionOpen = e.detail;
          }}
        >
          <Input bind:value={searchText} type="search" placeholder="enter text..." />
        </AccordionItem>

        {#if searchAllowFaces}
          <AccordionItem 
            header="Current Faces"
            on:toggle={(e) => {
              searchInputId = 2;
              accordionOpen = e.detail;
            }}
          >
            <div class="image-container">
              {#each faces as face, i}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="image-item" onclick={() => toggleFace(i)}>
                  <Image class=" {face.selected ? 'border border-primary border-3' : ''}" thumbnail alt="Face Thumbnail" src={face.src} style="max-height: 15vh;"/>
                </div>
              {/each}
            </div>
          </AccordionItem>
        {/if}
        
      </Accordion>

      <Container fluid class="h-100" >
        {#if searchRowResults.length === 0}
          <p class="text-center text-muted my-4">Start New Search</p>
        {:else}        
          {#each searchRowResults as row (row.fileHash)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div onclick={() => searchSelected(row) }>
              <SearchResultCard {row} {mediaDir}    />
            </div>
          {/each}          
        {/if}
      </Container>
      
    </ModalBody>
    <ModalFooter >
      <Button disabled={isProcessing} color="primary" on:click={search} class="me-4"><Icon name="search" class="fs-3"/></Button>
      <Button disabled={isProcessing} color="secondary" on:click={toggleSearch} class="ms-4 me-2"><Icon name="x-square-fill" class="fs-3"/></Button>
    </ModalFooter>
  </Modal>

</Container>


<style>
  .image-container {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    padding: 1rem;
  }
  .image-item {
    flex: 0 0 auto;
    margin-right: 1rem;
    cursor: pointer;
    border: 2px solid transparent;
  }

</style>


<!--// if (!false) {
  //   const link = document.createElement('a');
  //   link.href = '/tagging';

  //   // Append to the document to ensure it is part of the DOM
  //   document.body.appendChild(link);

  //   // Simulate a click on the link
  //   link.click();

  //   // Remove the link from the document
  //   document.body.removeChild(link);
  //   return;
  // }
-->
<!--      <Container  fluid class="d-flex flex-column h-100 .min-h-0" style="min-height: 0; background-color:red" >
        {#each faces as face, i}
          <!~~ svelte-ignore a11y_click_events_have_key_events ~~>
          <!~~ svelte-ignore a11y_no_static_element_interactions ~~>
            <div class="tt p-2">
              <img class="zz" alt="Landscape" src={face.src}  />
            </div>          
        {/each}
      </Container>-->
<!-- <div class="image-item {face.selected ? 'border border-primary border-3' : ''}"> -->
  <!-- <Figure caption="I believe this is a cow needing a haircut" class="tt">
    <Image fluid alt="Landscape" src={face.src}  />
  </Figure> -->
<!-- <Image fluid alt="This is a fluid Image" src={face.src} class="tt"/> -->
<!-- </div> -->

<!-- 
const imgEl = document.getElementById('viewing-image-id') as HTMLImageElement;
const bmp  = await createImageBitmap(imgEl);      // or Blob / ArrayBuffer
const off  = new OffscreenCanvas(bmp.width, bmp.height);
const ctx  = off.getContext('2d')!;
ctx.drawImage(bmp, 0, 0);
const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);

// await img. -->