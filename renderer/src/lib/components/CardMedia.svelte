<script lang="ts">
  import { CardImg } from "@sveltestrap/sveltestrap";
  import PdfViewer from 'svelte-pdf';

  let {filePath, fileType}: {filePath: string, fileType: string} = $props();  
	// let wrapper: HTMLDivElement|null; // DOM ref (not reactive)
	// let scale = $state(1); 
	// /* ---------- side-effect ---------- */
	// $effect(() => {
	// 	if (wrapper) {
	// 		// 795 px ≈ 8.27 in at 96 dpi – tweak to taste
	// 		scale = wrapper.clientWidth / 795;
	// 	}
	// });

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
  <object data={filePath} type="application/pdf" class="w-100 p-2"><p>Browser does not support PDFs</p></object>
   <!-- svelte-ignore svelte_component_deprecated -->
  <!-- <div
        bind:this={wrapper}
        class="w-100 overflow-auto"
        style="height:20vh">
        <PdfViewer
            url={filePath}
            {scale}
            showBorder={false}
            showButtons={['navigation','zoom']} />
    </div> -->
  
  <!-- <embed src={filePath} type="application/pdf" class="w-100"/> -->
  <!-- <iframe src={filePath} class="w-100">Fallback content</iframe> -->
{:else}
  <div class="alert alert-warning p-2">Unsupported file type: {fileType}</div>
{/if}