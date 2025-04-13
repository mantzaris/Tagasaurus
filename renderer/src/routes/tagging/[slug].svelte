<script lang="ts">
import { Container, Row, Col, Button, Input, Icon, Image, Modal, ModalBody, ModalHeader, ModalFooter, Accordion, AccordionItem, Figure } from '@sveltestrap/sveltestrap';
import { params } from '@roxi/routify';

import MediaView from '$lib/MediaView.svelte';
import { getContext, onMount } from 'svelte';
import { getMediaFile } from '$lib/utils/temp-mediafiles';
import type { MediaFile } from '$lib/types/general-types';
import { getMediaDir } from '$lib/utils/localStorageManager';
import { getMediaFilePath } from '$lib/utils/utils';

let { slug } = $params; //hash

let mediaDir: string = $state( getContext('mediaDir') );
let mediaFile: MediaFile | undefined = $state(undefined);

onMount(async () => {
  mediaDir = await getMediaDir();
  mediaFile = await getMediaFile(slug);


  // if (!false) {
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

});






let imageUrl = "../../../assets/images/Taga.png";

let description = "hi";
let mode: "edit" | "gallery" = "edit";
let openSearch = false;










const toggleSearch = () => {
  openSearch = !openSearch
  console.log(`open search = ${openSearch}`)
};

let searchInputId = 1;
let accordionOpen = true;

const toggleSearchAccordion = (...args: any[]) => {
  console.log('toggle', ...args);
};

let faces = [
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
];

function toggleFace(i: number) {
  faces[i] = {
    ...faces[i],
    selected: !faces[i].selected
  };
  faces = [...faces];
}
</script>

 
<Container  fluid class="d-flex flex-column vh-100 p-2 m-0 .min-vh-0" style="min-height: 0;" >
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
        <Button color="danger" size="sm"><Icon name="x-square-fill" class="fs-4"/></Button>
      </Col>
    </Row>
    <!-- Bottom row: Center group -->
    <Row class="mb-2">
      <Col class="d-flex justify-content-center gap-2">
        <Button color="primary" size="sm"><Icon name="caret-left-fill" class="fs-4"/></Button>
        <Button color="primary" size="sm" on:click={toggleSearch}><Icon name="search" class="fs-4"/></Button>
        <Button color="primary" size="sm"><Icon name="caret-right-fill" class="fs-4"/></Button>
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
        <Button color="primary" size="md"><Icon name="caret-left-fill" class="fs-3"/></Button>
        <Button color="primary" size="md" on:click={toggleSearch}><Icon name="search" class="fs-3"/></Button>
        <Button color="primary" size="md"><Icon name="caret-right-fill" class="fs-3"/></Button>
      </Col>
      <Col xs="4" class="d-flex justify-content-end">
        <Button color="danger" size="md"><Icon name="x-square-fill" class="fs-3"/></Button>
      </Col>
    </Row>
  </div>



  {#if mode === "edit"}  <!-- Edit Mode: Two columns -->
    <Row style="flex: 1;">
      <!-- Left column: description and save button -->
      <Col sm="5" lg="4" class="d-flex flex-column justify-content-center p-3 " >
        <textarea class="h-75 form-control mb-2" placeholder="description..." ></textarea>
        <Button class="mybtn" color="success" size="lg"><Icon name="save-fill" /></Button>
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
                on:click={() => toggleFace(i)}
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