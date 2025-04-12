<script lang="ts">
  import { CardImg } from "@sveltestrap/sveltestrap";

  let {filePath, fileType}: {filePath: string, fileType: string} = $props();  

</script>
  
{#if fileType.startsWith('image/')}
  <!-- <img src={filePath} alt={fileType} class="img-fluid p-2" /> -->
  <CardImg top src={filePath} alt={fileType} class="p-2"/>
{:else if fileType.startsWith('video/')}
  <!-- svelte-ignore a11y_media_has_caption -->
  <video controls preload="metadata" class="h-100 w-100 p-2">
    <source src={filePath} type={fileType} />
  </video>
{:else if fileType.startsWith('audio/')}
  <audio controls preload="metadata" class="w-100 p-2">
    <source src={filePath} type={fileType} />
  </audio>
{:else}
  <div class="alert alert-warning p-2">Unsupported file type: {fileType}</div>
{/if}