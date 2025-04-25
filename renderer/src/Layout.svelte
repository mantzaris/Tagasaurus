<script lang="ts">
import { onMount, setContext } from 'svelte';
import { getMediaDir } from '$lib/utils/localStorageManager';
import { Toast, Icon } from '@sveltestrap/sveltestrap';
import { fillSampleMediaFiles } from '$lib/utils/temp-mediafiles';
import { detectGPU } from '$lib/utils/detect-gpu';
import { type DeviceGPU } from './lib/types/general-types';

import '$lib/utils/transformers-init';

let { children } = $props();

let isOpen = $state(false);
let mediaDir: string|null = $state(null);
let deviceGPU: DeviceGPU = $state('wasm'); //wasm is cpu

$effect(() => {
    setContext('mediaDir', mediaDir);
});
$effect(() => {
    setContext('gpuDevice', deviceGPU);
});

onMount(async () => {
  deviceGPU = await detectGPU();
  console.log(`gpuDevice layout = ${deviceGPU}`)

  fillSampleMediaFiles(); //fire n'4get
  mediaDir = await getMediaDir();
});

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