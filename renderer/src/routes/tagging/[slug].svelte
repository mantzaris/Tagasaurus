<script lang="ts">
import { Container, Row, Col, Button, Input, Icon, Image, Modal, ModalBody, ModalHeader, ModalFooter, Accordion, AccordionItem, Figure, Tooltip } from '@sveltestrap/sveltestrap';
import { goto, params } from '@roxi/routify';

import MediaView from '$lib/MediaView.svelte';
import { getContext, onMount } from 'svelte';
import { fillSampleMediaFiles, getCombinedCounts, getMediaFile, getRandomMediaFile, getTotalMediaFileCount, removeMediaFileSequential } from '$lib/utils/temp-mediafiles';
import type { MediaFile } from '$lib/types/general-types';
import { getMediaDir } from '$lib/utils/localStorageManager';
import { getMediaFilePath } from '$lib/utils/utils';

let { slug } = $params; //hash

let mediaDir: string = $state( getContext('mediaDir') );
let mediaFile: MediaFile | undefined = $state(undefined);
let seenMediaFiles: MediaFile[] = $state([]);

let mode: "edit" | "gallery" = $state("edit");
let openSearch = $state(false);

let searchInputId = $state(1);
let accordionOpen = $state(true);

let askDelete = $state(false);

onMount(async () => {
  console.log("on mount slug")
  try {
    mediaDir = await getMediaDir();

    if(!slug) {
      mediaFile = await getRandomMediaFile(true);
    } else {
      mediaFile = await getMediaFile(slug);
    }

    if(!mediaFile) {
      window.location.href = "/tagging"
    } else {
      seenMediaFiles.push(mediaFile);
    }  
  } catch (error) {
    console.error("Error during media retrieval:", error);
    window.location.href = "/tagging" //$goto('/tagging');
  }
});

async function nextMediaFile() {
  try {
    mediaFile = await getRandomMediaFile(true);
  
    if (mediaFile) {
      seenMediaFiles.push(mediaFile);

      if (seenMediaFiles.length > 400) {
        seenMediaFiles.shift();
      }
    } else {
      window.location.href = "/tagging"; //$goto('/tagging');
    }
  } catch (error) {
    console.error("Error in nextMediaFile:", error);
    window.location.href = "/tagging" //$goto('/tagging');
  }
}

async function prevMediaFile() {
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
  console.log("Deleting file", mediaFile?.fileHash);
  askDelete = false;

  if(mediaFile) {
    //frontend
    seenMediaFiles = seenMediaFiles.filter(file => file.fileHash !== mediaFile?.fileHash);
    await removeMediaFileSequential(mediaFile.fileHash)
    //backend
    window.bridge.deleteMediaFile(mediaFile?.fileHash);
  }

  const freshCount = await getTotalMediaFileCount();
  if( freshCount <= 0 ) {
    window.location.href = "/tagging";
  }

  nextMediaFile();
}


const toggleSearch = () => {
  openSearch = !openSearch
};


const toggleSearchAccordion = (...args: any[]) => {
  console.log('toggle', ...args);
};

let faces = $state([
{ id: 1, src: 'https://picsum.photos/100/100?random=1', selected: false },
{ id: 2, src: 'https://picsum.photos/300/100?random=2', selected: false },
{ id: 3, src: 'https://picsum.photos/100/100?random=3', selected: false },
{ id: 4, src: 'https://picsum.photos/100/300?random=3', selected: false },
{ id: 5, src: 'https://picsum.photos/100/100?random=5', selected: false },
{ id: 6, src: 'https://picsum.photos/200/150?random=4', selected: false },
{ id: 7, src: 'https://picsum.photos/100/100?random=7', selected: false },
{ id: 8, src: 'https://picsum.photos/100/100?random=8', selected: false },
{ id: 9, src: 'https://picsum.photos/100/100?random=9', selected: false },
{ id: 10, src: 'https://picsum.photos/500/300?random=11', selected: false },
{ id: 11, src: 'https://picsum.photos/100/100?random=11', selected: false }
]);

function toggleFace(i: number) {
  faces[i] = {
    ...faces[i],
    selected: !faces[i].selected
  };
  faces = [...faces];
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
    <Row class="mb-2 align-items-center">
      <Col xs="6" class="d-flex justify-content-start">
        <Button color="primary" size="sm" href="/"><Icon name="house-fill" class="fs-4"/></Button>

        <Input type="select" class="w-auto ms-1 me-2" bind:value={mode}>
          {#each ["edit", "gallery"] as option}
            <option value={option}>{option}</option>
          {/each}
        </Input>
      </Col>
      <Col xs="6" class="d-flex justify-content-end">
        <Button onclick={openDeleteModal} id="btn-delete-sm" color="danger" size="sm"><Icon name="x-square-fill" class="fs-4"/></Button>
        <Tooltip target="btn-delete-sm" placement="bottom">Delete</Tooltip>
      </Col>
    </Row>
    <!-- Bottom row: Center group -->
    <Row class="mb-2">
      <Col class="d-flex justify-content-center gap-2">
        <Button onclick={prevMediaFile} color="primary" size="sm"><Icon name="caret-left-fill" class="fs-4"/></Button>
        <Button color="primary" size="sm" on:click={toggleSearch}><Icon name="search" class="fs-4"/></Button>
        <Button onclick={nextMediaFile} color="primary" size="sm"><Icon name="caret-right-fill" class="fs-4"/></Button>
      </Col>
    </Row>
  </div>

  <!-- Layout for small screens and up -->
  <div class="d-none d-sm-block">
    <Row class="mb-2 align-items-center">
      <Col xs="4" class="d-flex justify-content-start">
        <Button color="primary" size="md" href="/"><Icon name="house-fill" class="fs-3"/></Button>
        
        <Input type="select" class="w-auto ms-2 me-2" bind:value={mode}>
          {#each ["edit", "gallery"] as option}
            <option value={option}>{option}</option>
          {/each}
        </Input>

      </Col>
      <Col xs="4" class="d-flex justify-content-center gap-3">
        <Button onclick={prevMediaFile} color="primary" size="md"><Icon name="caret-left-fill" class="fs-3"/></Button>
        <Button color="primary" size="md" on:click={toggleSearch}><Icon name="search" class="fs-3"/></Button>
        <Button onclick={nextMediaFile} color="primary" size="md"><Icon name="caret-right-fill" class="fs-3"/></Button>
      </Col>
      <Col xs="4" class="d-flex justify-content-end">
        <Button onclick={openDeleteModal} id="btn-delete-md" color="danger" size="md"><Icon name="x-square-fill" class="fs-3"/></Button>
        <Tooltip target="btn-delete-md" placement="bottom">Delete</Tooltip>
      </Col>
    </Row>
  </div>



  {#if mode === "edit"}  <!-- Edit Mode: Two columns -->
    <Row style="flex: 1;">
      <!-- Left column: description and save button -->
      <Col sm="5" lg="4" class="d-flex flex-column justify-content-center p-3 " >
        <textarea class="h-75 form-control mb-2" placeholder="description..." >{mediaFile?.description}</textarea>
        <Button id="btn-save" class="mybtn" color="success" size="lg"><Icon name="save-fill" /></Button>
        <Tooltip target="btn-save" placement="top">Save</Tooltip>
      </Col>

      <Col sm="7" lg="8" class="d-flex flex-column p-3 image-col" >
        
        {#if mediaFile}
          <MediaView imageUrl={getMediaFilePath(mediaDir,mediaFile.fileHash)} fileType={mediaFile.fileType}/>  
        {:else}
          Not Found
        {/if}  
      
      </Col>
    </Row>
  {:else if mode === "gallery"}
    <div style="flex: 1;">
      
      {#if mediaFile}
        <MediaView imageUrl={getMediaFilePath(mediaDir,mediaFile.fileHash)} fileType={mediaFile.fileType}/>
      {:else}
        Not Found
      {/if}
    
    </div>
  {/if}

  <Modal isOpen={openSearch} toggle={toggleSearch} scrollable size={"xl"}>
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
          <Input type="search" placeholder="enter text..." />
        </AccordionItem>
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
              <div
                class="image-item"
                onclick={() => toggleFace(i)}
              >
                <Image class=" {face.selected ? 'border border-primary border-3' : ''}" thumbnail alt="Face Thumbnail" src={face.src} style="max-height: 15vh;"/>
              </div>
            {/each}
          </div>
        </AccordionItem>
      </Accordion>

      <Container fluid class="h-100" >
        <Row class="g-0">
          {#each faces as face}
            <Col lg="6" class="d-flex justify-content-center align-items-center p-2">
              <img class="img-fluid face-cell " src={face.src} alt="face" style="max-height: 100%; object-fit: contain; cursor: pointer;" />
            </Col>
          {/each}
        </Row>
      </Container>
      
    </ModalBody>
    <ModalFooter >
      <Button color="primary" on:click={toggleSearch} class="me-4"><Icon name="search" class="fs-3 "/></Button>
      <Button color="secondary" on:click={toggleSearch} class="ms-4 me-2"><Icon name="x-square-fill" class="fs-3"/></Button>
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

  .face-cell {
    height: 20vh !important;
  }

  @media (max-width: 1000px) {
    .face-cell {
      height: 25vh !important;
    }
  }

  @media (max-height: 768px) {
    .face-cell {
      height: 20vh !important;
    }
  }

  @media (max-height:550px) {
    .face-cell {
      height: 15vh !important;
    }
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