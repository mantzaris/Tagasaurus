<script lang="ts">
import { getContext, onMount } from 'svelte';
import { Button, Col, Container, Icon, Input, Modal, ModalBody, ModalFooter, ModalHeader, Row } from '@sveltestrap/sveltestrap';
import type { SearchRow } from '$lib/types/general-types';
import StreamResultCard from '$lib/components/StreamResultCard.svelte';

const optionLabels = ["none", "camera", "screen"];

let mediaDir: string = $state( getContext('mediaDir') );

let videoEl: HTMLVideoElement | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let isPaused = $state(false);
let hasStream = $state(false);
const placeholderUrl = new URL('./tall.jpg', import.meta.url).href;
let  testRows = $state<SearchRow[]>([]);

type SourceOption = "none"|"screen"|"camera";
type ModalSourceSelect = { type: "camera"|"screen"|"none", source_options: string[] }
let sourceSelected: SourceOption = $state('none');
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

    if(!wayland) {
        if( input == 'camera') {
            getCameraSources();
        } else if( input == 'screen') {
            getScreenSources();
        } else {
            // stop the stream
        }
    }
}

async function getScreenSources() {
    const srcs  = await window.bridge.listDesktopSources();
    console.log("desktop sources:", srcs);
    // @ts-ignore
    selectModalOptions = { type: 'screen', source_options: srcs.map(s=> s.name)}
    toggleSelectModal();
    return srcs;
}

async function getCameraSources() {
    const cams  = await window.bridge.listMediaDevices();
    console.log("cams:", cams);
    selectModalOptions = { type: 'camera', source_options: cams.map(c=> c.label)}
    toggleSelectModal();
    return cams;
}

let newSource = $state([]);
$effect(()=> console.log(newSource));
let open = $state(false);
const toggleSelectModal = () => (open = !open);
let selectModalOptions = $state<ModalSourceSelect>({type: 'none', source_options: []});
</script>


<Modal isOpen={open} toggle={toggleSelectModal} scrollable={true}>
    <ModalHeader toggle={toggleSelectModal}>Select Source</ModalHeader>
    <ModalBody>
      {#each selectModalOptions.source_options as value}
        <Input type="radio" {value} label={value} bind:group={newSource} />
      {/each}
    </ModalBody>
    <ModalFooter>
      <!-- <Button color="primary" on:click={toggleSelectModal}>Do Something</Button> -->
      <Button color="secondary" on:click={toggleSelectModal}>Cancel</Button>
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
                    <Input disabled={isPaused} type="select" class="w-50 ms-1 me-2" bind:value={sourceSelected}>
                    {#each optionLabels as option}
                        <option value={option} class="fs-6">{option}</option>
                    {/each}
                    </Input>
                </Col>
                <Col xs="auto" class="d-flex justify-content-end">
                    <Button color="primary" size="sm" href="/">
                        <Icon name="pause" class="fs-6"/>
                    </Button>
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
                    <Input disabled={isPaused} type="select" class=" w-50   ms-2 me-2 fs-3   ">
                    {#each optionLabels as option}
                        <option value={option}>{option}</option>
                    {/each}
                    </Input>
                </Col>
                <Col xs="auto" class="d-flex justify-content-end">
                    <Button color="primary" size="md" href="/">
                        <Icon name="pause" class="fs-3"/>
                    </Button>
                </Col>
            </Row>
        </div>

    </div>

    <!-- Stream Display -->
    <div class="flex-fill border p-1 overflow-auto" style="min-height:0; background-color: green;">
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