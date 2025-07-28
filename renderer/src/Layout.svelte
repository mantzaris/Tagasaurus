<script lang="ts">
import { onMount, setContext } from 'svelte';
import { getMediaDir, getSystemInfo } from '$lib/utils/localStorageManager';
import { Toast, Icon } from '@sveltestrap/sveltestrap';
import { clearSessionMediaCache, fillSampleMediaFiles } from '$lib/utils/temp-mediafiles';
import { detectGPU } from '$lib/utils/detect-gpu';
import { type DeviceGPU } from './lib/types/general-types';
import type { DisplayServer} from '$lib/utils/localStorageManager';

let { children } = $props();

let isOpen = $state(false);
let mediaDir = $state<string | null>(null);
let deviceGPU: DeviceGPU = $state('wasm'); //wasm is cpu
let isLinux = $state(false);
let displayServer = $state<DisplayServer>('unknown');

setContext('isLinux', () => isLinux);
setContext('displayServer', () => displayServer);
setContext('mediaDir', () => mediaDir);
setContext('gpuDevice', () => deviceGPU);

$effect(() => setContext('isLinux', () => isLinux));
$effect(() => setContext('displayServer', () => displayServer));
$effect(() => { setContext('gpuDevice', () => deviceGPU); });


onMount(async () => {
  await clearSessionMediaCache();


  deviceGPU = await detectGPU();
  console.log(`gpuDevice layout = ${deviceGPU}`)

  fillSampleMediaFiles(); //fire n'4get
  mediaDir = await getMediaDir();

  const info          = await getSystemInfo();
	isLinux             = info.isLinux;
	displayServer       = info.displayServer ?? 'unknown';
  console.log(`is linux = ${isLinux} and displayServer = ${displayServer}`)
});


function handleDragOver(event: DragEvent) {
  event.preventDefault();
}

function handleDrop(event: DragEvent) {
    event.preventDefault();

    const paths = Array.from(event.dataTransfer?.files ?? [])
      // call the helper we expose from preload (see next section)
      .map(file => window.bridge.getPathForFile(file))
      .filter(Boolean);          // strips empty strings / directories

    window.bridge.sendDroppedPaths(paths);
    isOpen = true;
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