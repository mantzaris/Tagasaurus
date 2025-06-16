<script lang="ts">
import { getContext, onMount } from 'svelte';
import { Button, Col, Container, Icon, Input, Row } from '@sveltestrap/sveltestrap';
import type { SearchRow } from '$lib/types/general-types';
import StreamResultCard from '$lib/components/StreamResultCard.svelte';
  import SearchResultCard from '$lib/components/SearchResultCard.svelte';

let mediaDir: string = $state( getContext('mediaDir') );

let videoEl: HTMLVideoElement | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let isPaused = $state(false);
let hasStream = $state(false);
const placeholderUrl = new URL('./wide.jpg', import.meta.url).href;
let  testRows = $state<SearchRow[]>([]);


onMount(async () => {
    try {
        // const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        // if (videoEl) videoEl.srcObject = stream;
        
    } catch (err) {
        console.error('Webcam access refused:', err);
    }
});



</script>


<Container fluid class="vh-100 d-flex p-2 gap-3 no-scroll" style="background-color: purple;">

<div class="d-flex flex-column flex-grow-1" style="flex-basis:75%; min-width:0; min-height:0; background-color: aqua;">
    <!-- Control Buttons -->
    <div class="flex-shrink-0 border p-1" style="flex-basis:10%; min-height:0; background-color: yellow;">

        <!-- Extra‑small screens ( <576 px ) -->
        <div class="d-block d-lg-none h-100">
            <Row class="h-100 align-items-center ">
                <Col xs="auto" class="d-flex justify-content-start">
                    <Button color="primary" size="sm" href="/">
                        <Icon name="house-fill" class="fs-6"/>
                    </Button>
                </Col>
                <Col class="d-flex justify-content-center">
                    <Input disabled={isPaused} type="select" class="w-auto ms-1 me-2">
                    {#each ['edit', 'gallery'] as option}
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
                <Col class="d-flex justify-content-center">
                    <Input disabled={isPaused} type="select" class="w-auto ms-2 me-2 fs-3">
                    {#each ['edit', 'gallery'] as option}
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
</style>