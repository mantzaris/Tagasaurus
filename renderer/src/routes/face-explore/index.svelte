<script lang="ts">
import { onMount, tick } from 'svelte';
import { Button, Col, Container, Icon, Input, Modal, ModalBody, ModalFooter, ModalHeader, Row } from '@sveltestrap/sveltestrap';
import { kmeans } from 'ml-kmeans';
import { distanceCosine0to2 } from '$lib/utils/ml-utils';

import type { Network, DataSet, Node, Edge } from 'vis-network';  // just types





  let container: HTMLDivElement | null = null;
  let network: Network | null = null;

  onMount(async () => {
    await tick();                         // wait for bind:this
    if (!container) return;

    const nodes = new vis.DataSet<Node>([{ id: 1, label: 'Hello' }]);
    const edges = new vis.DataSet<Edge>([]);
    network = new vis.Network(container, { nodes, edges }, {});
  });







let searchRows = $state([]);


const initOptions = [10, 20, 30, 40] as const;
let initSelected = $state<number>(initOptions[0]);
let freshStart = $state(true);

const kmeansOptions = {
  initialization: 'kmeans++',
  maxIterations: 50,
  tolerance: 1e-4,
  // distanceFunction: (a, b) => /* custom dist, e.g., cosine if normalized */
};
//const result = kmeans(data, k)

function toggleRestart() {
    return undefined;
}


function medoidIndices(
  data: number[][],
  clusters: number[],
  centroids: { centroid:number[] }[]
): number[] {
  const k = centroids.length;
  const best = Array(k).fill(Infinity);
  const idx  = Array(k).fill(-1);

  data.forEach((vec, i) => {
    const c = clusters[i];
    const d = distanceCosine0to2(vec, centroids[c].centroid);
    if (d < best[c]) { best[c] = d; idx[c] = i; }
  });
  return idx; //eg [42, 817, ...] : rows in `data`
}
//const medoids = medoidIndices(data, result.clusters, result.centroids);


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
                    <Input type="select" class="w-50 ms-1 me-2" bind:value={initSelected}>
                    {#each initOptions as option}
                        <option value={option} class="fs-6">Init: {option}</option>
                    {/each}
                    </Input>
                </Col>
                <Col xs="auto" class="d-flex justify-content-end">
                    <Button color="primary" size="sm" onclick={toggleRestart} >
                        {#if freshStart} 
                        <Icon name="play-circle-fill"  class="fs-6" />
                        {:else}
                        <Icon name="recycle" class="fs-6" />
                        {/if}
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
                    <Input type="select" class=" w-25   ms-2 me-2 fs-3" bind:value={initSelected}>
                    {#each initOptions as option}
                        <option value={option}>Init: {option}</option>
                    {/each}
                    </Input>
                </Col>
                <Col xs="auto" class="d-flex justify-content-end">
                    <Button color="primary" size="sm" onclick={toggleRestart} >
                        {#if freshStart}
                        <Icon name="play-circle-fill"  class="fs-3" />
                        {:else}
                        <Icon name="recycle" class="fs-3" />
                        {/if}
                    </Button>
                </Col>
            </Row>
        </div>

    </div>

    <!-- Stream Display -->
    <div class="flex-fill border p-1 overflow-auto" style="min-height:0; ">
       <!-- VideoCapture -->
       <div class="capture-wrapper">
          
        
      </div>
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