<script lang="ts">
import { onMount, tick } from 'svelte';
import { Button, Col, Container, Icon, Input, Modal, ModalBody, ModalFooter, ModalHeader, Row } from '@sveltestrap/sveltestrap';

import type { Network, DataSet, Node, Edge, Options } from 'vis-network';  // just types
import type { MediaFile, FaceEmbeddingSample } from '$lib/types/general-types';

const VIDEO_ICON = '/assets/icons/videoplay512.png';

let initMedia: MediaFile[] = $state([]);
let searchRows = $state([]);

const initKOptions = [10, 20, 40, 60, 100] as const;
const initSampleSize = [200, 400, 800, 1200, 2000] as const;
const kToSampleMap = new Map<(typeof initKOptions)[number],(typeof initSampleSize)[number]>(initKOptions.map((k, i) => [k, initSampleSize[i]] as const));

let initNumberSelected = $state<number|undefined>(kToSampleMap.get(initKOptions[0]));
let fitK = $derived( Math.round(initMedia.length / 20) );


let container: HTMLDivElement | null = null;
let network: Network | null = null;


onMount(async () => {
    await tick(); //wait for bind:this

    initMedia = await window.bridge.requestRandomEntries(initNumberSelected);


    drawNetwork();    
});

async function toggleRestart() {
    initMedia = await window.bridge.requestRandomEntries(initNumberSelected);

    return drawNetwork();
}


function drawNetwork() {
  if (!container) return;

  const nodes = new vis.DataSet<Node>(mediaToNodes(initMedia));
  const edges = new vis.DataSet<Edge>([]);  
  const data  = { nodes, edges };
  const opts  = buildOptions();

  if (network) {
    network.setData(data);
    network.setOptions(opts); 
  } else {
    network = new vis.Network(container, data, opts);
  }
}


function mediaToNodes(media: MediaFile[]): Node[] {
  const R = 250;
  const n = media.length;
  if (n === 0) return [];

  return media.map((m, i) => {
    const θ = (2 * Math.PI * i) / n;
    const x = R * Math.cos(θ);
    const y = R * Math.sin(θ);

    return {
      id: m.id ?? i,
      label: '',
      image: VIDEO_ICON,
      shape: 'image', //change to 'image' later
      size: 50,
      fixed: false,
      x, y
    } satisfies Node;
  });
}

function buildOptions(): Options {
  return {
    nodes: {
      shape: 'box',  
      size: 50,
      shapeProperties: { useImageSize: false }
    },
    edges: {
      arrows: 'to'
    },
    interaction: {
      dragNodes: true,
      zoomView: true,
      hover: true,
      multiselect: false
    },
    physics: { enabled: false },
    layout:  { improvedLayout: false }
  };
}







</script>


<Container fluid class="vh-100 d-flex p-2 gap-3 no-scroll">

<div class="d-flex flex-column flex-grow-1" style="flex-basis:75%; min-width:0; min-height:0;">
    <!-- Control Buttons -->
    <div class="flex-shrink-0 border p-1 util-controlbar">

        <!-- Extra‑small screens ( <576 px ) -->
        <div class="d-block d-lg-none h-100">
            <Row class="h-100 align-items-center ">
                <Col xs="auto" class="d-flex justify-content-start">
                    <Button color="primary" size="sm" href="/">
                        <Icon name="house-fill" class="fs-6"/>
                    </Button>
                </Col>
                <Col class="d-flex justify-content-center   ">
                    <Input type="select" class="w-50 ms-1 me-2" bind:value={initNumberSelected}>
                    {#each initKOptions as option}
                        <option value={option} class="fs-6">Init: {option}</option>
                    {/each}
                    </Input>
                </Col>
                <Col xs="auto" class="d-flex justify-content-end">
                    <Button color="primary" size="sm" onclick={toggleRestart} >
                        <Icon name="recycle" class="fs-6" />
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
                    <Input type="select" class=" w-25   ms-2 me-2 fs-3" bind:value={initNumberSelected}>
                    {#each initKOptions as option}
                        <option value={option}>Init: {option}</option>
                    {/each}
                    </Input>
                </Col>
                <Col xs="auto" class="d-flex justify-content-end">
                    <Button color="primary" size="sm" onclick={toggleRestart} >
                        <Icon name="recycle" class="fs-3" />
                    </Button>
                </Col>
            </Row>
        </div>

    </div>

    <!-- Network Display -->
    <div bind:this={container} class="flex-fill border p-1 overflow-auto" style="min-height:0;">
       

        
    </div>
  
</div>

<!-- search results -->
<div class="flex-grow-1 border p-1 overflow-auto border-end-0 border-bottom-0 border-top-0 border-2 border-success" style="flex-basis:25%; min-width:0; min-height:0;">
    <!-- <Container fluid class="h-100 mt-2" style="background-color:bisque"> -->
        
            {#each searchRows as row}
                
            Hello

            {/each}

    <!-- </Container> -->
</div>


</Container>