<script lang="ts">
  import { CardImg } from "@sveltestrap/sveltestrap";
  import PdfViewer from 'svelte-pdf';

  let {filePath, fileType}: {filePath: string, fileType: string} = $props();  

  let wrapper = $state<HTMLDivElement | null>(null);
	let scale = $state(1); 
	$effect(() => {
		if (wrapper) {
			// 795 px around 8.27 in at 96 dpi
			scale = wrapper.clientWidth / 795;
		}
	});

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
{:else if fileType.startsWith('application/pdf')}
  <!-- svelte-ignore a11y_missing_attribute -->
  <!-- <object data={filePath} type="application/pdf" class="w-100 p-2"><p>Browser does not support PDFs</p></object> -->

  <div bind:this={wrapper} class="w-100 pdf">
    <PdfViewer
        url={filePath}
        {scale}
        showBorder={false}
        showButtons={['navigation','zoom']} />
  </div>

  <!-- <embed src={filePath} type="application/pdf" class="w-100"/> -->
  <!-- <iframe src={filePath} class="w-100">Fallback content</iframe> -->
{:else}
  <div class="alert alert-warning p-2">Unsupported file type: {fileType}</div>
{/if}


<style>
  .pdf {
    height:25vh !important;
    overflow:auto !important;
  }

  /* .pdf .page     { margin:0 !important; padding: 0 !important;}  */
  /* .pdf canvas    { max-width:100% !important; height:auto !important; } */
</style>