<script lang="ts">
import { onMount, setContext } from 'svelte';
import { getMediaDir } from '$lib/utils/localStorageManager';
import { Toast, Icon } from '@sveltestrap/sveltestrap';
import type { MediaFile } from '$lib/types/general-types';
import { addNewMediaFile, fillSampleMediaFiles } from '$lib/utils/temp-mediafiles';

import { env } from '@huggingface/transformers';

env.allowLocalModels  = true; //enable local lookup
env.allowRemoteModels = false; //refuse any HTTP download
env.localModelPath  = '/assets/models';
const MODEL_LOCAL_PATH = 'sentence-transformers/all-MiniLM-L6-v2';
(env as any).backends ??= {};
(env as any).backends.webgpu = { disable: true };


const be: any = (env as any).backends ?? ((env as any).backends = {});
const wasm    = be.wasm        ?? (be.wasm = {});
wasm.wasmPaths  = '/assets/ort/';
wasm.numThreads = navigator.hardwareConcurrency ?? 4; 


console.log('Active backend →', env.backends); // 'webgl' or 'wasm'

let { children } = $props();

let isOpen = $state(false);
let mediaDir: string|null = $state(null);
let gpuDevice: 'gpu' | 'wasm' = $state('wasm'); //wasm is cpu

$effect(() => {
    setContext('mediaDir', mediaDir);
});
$effect(() => {
    setContext('gpuDevice', gpuDevice);
});


onMount(async () => {
  gpuDevice = await detectDevice();
  console.log(`gpuDevice layout = ${gpuDevice}`)

  fillSampleMediaFiles(); //fire n'4get
  mediaDir = await getMediaDir();
});


async function detectDevice(): Promise<'gpu' | 'wasm'>  {
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(1, 1)
    : document.createElement('canvas');

  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (gl) {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg
      ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
      : '';
    // skip llvmpipe / SwiftShader (software)
    if (!/llvmpipe|SwiftShader/i.test(renderer)) return 'gpu';
  }
  return 'wasm'; 
}

function handleDragOver(event: DragEvent) {
  event.preventDefault(); 
}

function handleDrop(event: DragEvent) {
  event.preventDefault();

  //convert the dropped FileList to an array of absolute paths
  const paths: string[] = [];
  for (const item of event.dataTransfer?.files ?? []) {
    const filePath = (item as any).path; //Electron 'path' property
    paths.push(filePath);
  }
  
  //send the entire array of paths to the main process (handles directories too)
  window.bridge.sendDroppedPaths(paths);
  isOpen = true
}

</script>


<div class="toast-container">
    <Toast autohide fade={true} duration={200} delay={1200} body {isOpen} on:close={() => (isOpen = false)}>
      <Icon name="upload" /> Import started...
    </Toast>
</div>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div ondragover={handleDragOver} ondrop={handleDrop} style="width:100%; height:100vh;">

  <!-- <slot /> -->
  <!-- potentially,   {@render children?.()} -->
  {@render children()}

</div>

<style>
  /* Position the toast container at the top right */
  .toast-container {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 1050;
  }
</style>