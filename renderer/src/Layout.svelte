<script lang="ts">
import { onMount } from 'svelte';
import { addNewFileHash } from '$lib/utils/localStorageManager';
import { Toast, ToastBody, ToastHeader, Icon } from '@sveltestrap/sveltestrap';

let isOpen = false;

onMount(() => {
  
  window.bridge.onNewMedia((hash: string) => {
    addNewFileHash(hash); 
  });

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
    //console.log("Dropped file/folder path:", filePath);
    paths.push(filePath);
  }
  
  console.log("array set of files = ", paths)
  //send the entire array of paths to the main process
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
<div on:dragover={handleDragOver} on:drop={handleDrop} style="width:100%; height:100vh;">

  <slot />

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