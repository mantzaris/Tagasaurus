<script lang="ts">
import { getContext, onMount, tick } from 'svelte';
import { Button, Col, Container, Icon, Input, Modal, ModalBody, ModalFooter, ModalHeader, Row } from '@sveltestrap/sveltestrap';
import { getMediaDir } from '$lib/utils/localStorageManager';
import { getMediaFilePath } from '$lib/utils/utils';

import type { Network, DataSet, Node, Edge, Options } from 'vis-network';  // just types
import type { MediaFile, FaceEmbeddingSample, FaceHit } from '$lib/types/general-types';
import { midpointEmbedding, sampleClusterMedoids } from './explore-utils';

import { facesSetUp, getFaceThumbnail } from '$lib/utils/faces';


const VIDEO_ICON = '/assets/icons/videoplay512.png';
let mediaDir: string = $state(getContext('mediaDir')); 


let initSamples: FaceEmbeddingSample[] = $state([]);
let searchRows = $state([]);

const initKOptions = [10, 20, 40, 60, 100] as const;
type KOption = (typeof initKOptions)[number]; // 10 | 20 | 40 | 60 | 100

const kToSampleObj: Record<KOption, number> = {
  10: 200,
  20: 400,
  40: 800,
  60: 1200,
  100: 2000
};

let initKSelected = $state<KOption>(initKOptions[0]);
let initSampleNumber = $derived(kToSampleObj[initKSelected]);

let container: HTMLDivElement | null = null;
let network: Network | null = null;
let nodes!: DataSet<Node>;   
let edges!: DataSet<Edge>;
// filePath={getMediaFilePath(mediaDir,card.fileHash)}

//node network metadata
type FaceId = number; //the FaceEmbedding.id from the DB table for face embeddings
type NodeId = number; //may, or may not, coincide with SampleId if 1‑to‑1

interface NodeConn {
  nodeId          : NodeId; // unique in vis‑network
  faceId          : FaceId; // foreign‑key into facesById
  parentNodeId?   : NodeId; // undefined for roots
  parentFaceId?   : FaceId; // undefined for roots
  siblingNodeIds  : NodeId[];
  siblingFaceIds  : FaceId[];
  root            : boolean;
  clicked         : boolean;
}

const facesById = new Map<FaceId, FaceEmbeddingSample>();
const mapNodeId2Connections = new Map<NodeId, NodeConn>();

let nextNodeId = 1;
function mintNodeId(): NodeId {
  return nextNodeId++;
}

async function initNetwork() {
  facesById.clear();
  mapNodeId2Connections.clear();
  nextNodeId = 1;

  initSamples = await sampleClusterMedoids(initSampleNumber, initKSelected, Math.round(initKSelected/5));
  console.log(initSamples)
  const faceIds: FaceId[] = [];
  const nodeIds: NodeId[] = [];

  for (const sample of initSamples) {
    if (sample.id === undefined) continue;

    const nodeId = mintNodeId();
    const faceId = sample.id;

    nodeIds.push(nodeId);
    faceIds.push(faceId);

    facesById.set(faceId, sample);

    mapNodeId2Connections.set(nodeId, {
      nodeId,
      faceId,
      siblingNodeIds: [],
      siblingFaceIds: [],
      root: true, // root
      clicked: false
      // siblings filled after the loop
    });
  }

  // fill sibling lists as all nodeIds are ok
  for (const conn of mapNodeId2Connections.values()) {
    conn.siblingNodeIds = nodeIds.filter(id  => id  !== conn.nodeId);
    conn.siblingFaceIds = faceIds.filter(fid => fid !== conn.faceId);
  }

  await drawInitNetwork();  
}


onMount(async () => {
    try {        
      const setupSuccess = await facesSetUp();

      if (!setupSuccess) {
          console.error('Failed to set up face detection');
      }
    } catch (err) {
        console.error('Webcam access refused:', err);
    }
  
    await tick(); //wait for bind:this
    mediaDir = await getMediaDir();
  
    await initNetwork();

    if(network) {
      network.on('click', (params) => {
        if (params.nodes.length) {
          const nodeId = params.nodes[0];
          handleNodeClick(nodeId);
        }
      });
    }
});


async function handleNodeClick(parentNodeId: NodeId) {
  const parentFaceId = mapNodeId2Connections.get(parentNodeId)!.faceId;
  const rawEmb       = facesById.get(parentFaceId)!.faceEmbedding;

  const baseEmb = rawEmb instanceof Float32Array ? rawEmb : new Float32Array(rawEmb);
  
  const midPoints = computeSiblingMidpoints(parentNodeId);
  
  const queryVectors: Float32Array[] = [baseEmb, ...midPoints];
  if (!queryVectors.length) return;

  const perfaceMidPointCandidates = await searchEachMidpoint(queryVectors,20);
  console.log('perfaceMidPointCandidates: ', perfaceMidPointCandidates);

  const childrenNodeIds = addUniqueChildren(parentNodeId, perfaceMidPointCandidates);

  addChildrenToNetwork(parentNodeId, childrenNodeIds);
}


/**
 * Add visual nodes + edges for the freshly‑minted children
 * Preconditions:
 *  - facesById     already has an entry for every child faceId
 *  - mapNodeId2Connections has a NodeConn for every childNodeId
 *  - network.body.data.nodes / edges are the vis‑DataSets you created
 *
 * Behaviour:
 *   - Skips any child that (for whatever reason) is already present in vis‑nodes
 *   - Adds exactly ONE edge parent -> child
 *   - Lays children in a circle of radius `R` around the parent's current position
 */
async function addChildrenToNetwork(
  parentNodeId   : NodeId,
  childrenNodeIds: NodeId[],
  R = 160                               // radius for layout
) {
  if (!childrenNodeIds.length) return;

  // parent position (optional manual layout)
  const parent = nodes.get(parentNodeId) as Node | null;   
  const px = parent?.x ?? 0;
  const py = parent?.y ?? 0;

  const newVisNodes: Node[] = [];
  const newVisEdges: Edge[] = [];

  const n = childrenNodeIds.length;
  for (let i = 0; i < n; i++) {
    const childId = childrenNodeIds[i];
    if (nodes.get(childId)) continue;    

    const conn   = mapNodeId2Connections.get(childId)!;
    const sample = facesById.get(conn.faceId)!;

    const imgSrc =
      sample.fileType.startsWith('video')
        ? VIDEO_ICON
        : await getFaceThumbnail(
            getMediaFilePath(mediaDir, sample.fileHash),
            sample,
            1.5,
          );

    const θ = (2 * Math.PI * i) / n;
    const x = px + R * Math.cos(θ);
    const y = py + R * Math.sin(θ);

    newVisNodes.push({
      id: childId,
      shape: 'image',
      image: imgSrc,
      size: 40,
      x, y,
      label: '',
      fixed: false
    });

    newVisEdges.push({ from: parentNodeId, to: childId });
  }

  // bulk‑insert into the same DataSets used when creating the network
  if (newVisNodes.length) nodes.add(newVisNodes);
  if (newVisEdges.length) edges.add(newVisEdges);
}




/**
 * Given per‑midpoint hit buckets, pick <= 1 unique face from each bucket,
 * add those faces as child nodes, and return the newly minted NodeIds.
 *
 * - Skips a midpoint if none of its hits are unique.
 * - Updates facesById, mapNodeId2Connections, sibling arrays.
 * - Does NOT touch vis‑network; caller decides when/how to render.
 */
function addUniqueChildren(parentNodeId: NodeId, perMidHits: FaceHit[][]): NodeId[] {
  const newNodeIds: NodeId[] = [];
  const existingFaceIds = new Set<FaceId>(facesById.keys()); //global graph

  //choose at most one face per midpoint
  for (const hits of perMidHits) {
    const pick = hits.find(h => !existingFaceIds.has(h.face.id!));
    if (!pick) continue; // all dupes

    //mark so subsequent midpoints don't pick the same face
    existingFaceIds.add(pick.face.id!);

    //mint NodeId and maps
    const nodeId = mintNodeId();
    const { face, media } = pick;

    facesById.set(face.id!, {
      id            : face.id,
      mediaFileId   : face.mediaFileId,
      time          : face.time,
      faceEmbedding : face.faceEmbedding,
      score         : face.score,
      bbox          : face.bbox,
      landmarks     : face.landmarks,
      fileHash      : media.fileHash,
      fileType      : media.fileType,
    });

    mapNodeId2Connections.set(nodeId, {
      nodeId,
      faceId       : face.id!,
      parentNodeId : parentNodeId,
      siblingNodeIds : [],          // will fill later if desired
      siblingFaceIds : [],
      root     : false,
      clicked  : false,
    });

    newNodeIds.push(nodeId);
  }

  //new children to be siblings of each other
  if (newNodeIds.length > 1) {
    const newFaceIds = newNodeIds.map(id => mapNodeId2Connections.get(id)!.faceId);

    for (let i = 0; i < newNodeIds.length; i++) {
      const nodeId = newNodeIds[i];
      const conn   = mapNodeId2Connections.get(nodeId)!;

      // every other new child except self
      conn.siblingNodeIds = newNodeIds.filter(id => id !== nodeId);
      conn.siblingFaceIds = newFaceIds.filter(fid => fid !== conn.faceId);
    }
  }

  return newNodeIds;   // caller will add nodes + edges visually
}


async function searchEachMidpoint(midPoints: Float32Array[], k = 20): Promise<FaceHit[][]> {
  const perMidHits: FaceHit[][] = [];

  for (const vec of midPoints) {
    const hits = await window.bridge.searchFace([vec], k);   // pass one vec of a face a time
    perMidHits.push(hits);                                   // hits.length <= k
  }

  return perMidHits;   // array‑of‑arrays [[hit1-1, hit1-20], [hitK-1, hitK-20]]
}



function computeSiblingMidpoints(clickedNodeId: NodeId): Float32Array[] {
  const conn = mapNodeId2Connections.get(clickedNodeId);
  if (!conn) return [];

  const baseEmb = facesById.get(conn.faceId)?.faceEmbedding;
  if (!baseEmb?.length) return [];

  const mids: Float32Array[] = [];

  for (const sibFaceId of conn.siblingFaceIds) {
    const sibEmb = facesById.get(sibFaceId)?.faceEmbedding;
    if (sibEmb && sibEmb.length === baseEmb.length) {
      mids.push(midpointEmbedding(baseEmb, sibEmb, 0.6));
    }
  }
  return mids;
}




async function drawInitNetwork() {
  if (!container) return;

  const nodesArr = await initSamplesToNodes();
  nodes = new vis.DataSet<Node>(nodesArr);
  edges = new vis.DataSet<Edge>([]);
  
  const data  = { nodes, edges };
  const opts  = buildOptions();

  if (network) {
    network.setData(data);
    network.setOptions(opts); 
  } else {
    network = new vis.Network(container, data, opts);
  }  
}

async function initSamplesToNodes(): Promise<Node[]> {
  const R = 30 * mapNodeId2Connections.size;        // circle radius
  const n = mapNodeId2Connections.size;
  if(n==0) return [];

  const nodes: Node[] = [];
  let ind = 0;

  for (const conn of mapNodeId2Connections.values()) {
    const θ = (2 * Math.PI * ind) / n;
    const x = R * Math.cos(θ);
    const y = R * Math.sin(θ);
    ind++;

    const sample = facesById.get(conn.faceId)!;
    if (!sample) continue;  

    const imgSrc = sample.fileType.startsWith('video')
      || sample.fileType.startsWith('image/gif')
      || sample.fileType.startsWith('image/webp')
        ? VIDEO_ICON
        : await getFaceThumbnail( getMediaFilePath(mediaDir, sample.fileHash), sample, 1.5 );
    // console.log(imgSrc)

    nodes.push({
      id:  conn.nodeId, //sample.fileHash, // unique per media file
      label: '',
      image: imgSrc,
      shape: 'image',
      size: 50,
      fixed: false,
      x,
      y
    } satisfies Node);
  }

  return nodes;
}




function buildOptions(): Options {
  const newWidth = container!.offsetWidth;
  const newSpringLength = newWidth * 0.4;
  //TODO window.addEventListener('resize', () => { needs when the window is resized

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
    physics: { 
      enabled: true,
      barnesHut: {
        gravitationalConstant: -500,
        centralGravity: 0.05,
        springLength: newSpringLength,
        springConstant: 0.5,
        damping: 0.25,
        avoidOverlap: 0.8,
      }
    },
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
                    <Input type="select" class="w-50 ms-1 me-2" bind:value={initKSelected}>
                    {#each initKOptions as option}
                        <option value={option} class="fs-6">Init: {option}</option>
                    {/each}
                    </Input>
                </Col>
                <Col xs="auto" class="d-flex justify-content-end">
                    <Button color="primary" size="sm" onclick={initNetwork} >
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
                    <Input type="select" class=" w-25   ms-2 me-2 fs-3" bind:value={initKSelected}>
                    {#each initKOptions as option}
                        <option value={option}>Init: {option}</option>
                    {/each}
                    </Input>
                </Col>
                <Col xs="auto" class="d-flex justify-content-end">
                    <Button color="primary" size="sm" onclick={initNetwork} >
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