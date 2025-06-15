<script lang="ts">
  import { getMediaFilePath } from '$lib/utils/utils';
  import type { SearchRow } from '$lib/types/general-types';
  import PdfViewer from 'svelte-pdf';

  let { row, mediaDir }: { row: SearchRow; mediaDir: string } = $props();

  const filePath = getMediaFilePath(mediaDir, row.fileHash);

  let wrapper = $state<HTMLDivElement | null>(null);
	let scale = $state(1); 
	$effect(() => {
		if (wrapper) {
			// 795 px around 8.27 in at 96 dpi
			scale = wrapper.clientWidth / 795;
		}
	});

</script>

{#if row.fileType.startsWith('image/')}
    <div class="result-card mb-2">
      <!-- svelte-ignore a11y_img_redundant_alt -->
      <img class="media" src={filePath} alt="Gallery Image" />
      <!-- <CardImg top src={imageUrl} alt={fileType} class="p-2"/> -->
    </div>
{:else if row.fileType.startsWith('video/')}
    <div class="result-card mb-2">
      <!-- svelte-ignore a11y_media_has_caption -->
      <video controls preload="metadata" class="media p-2">
        <source src={filePath} type={row.fileType} />
      </video>
    </div>
{:else if row.fileType.startsWith('audio/')}
    <div class="result-card mb-2">
      <audio controls preload="metadata" class="media p-2">
        <source src={filePath} type={row.fileType} />
      </audio>
    </div>
{:else if row.fileType.startsWith('application/pdf')}
    <div class="result-card mb-2">
      <!-- svelte-ignore a11y_missing_attribute -->
      <!-- <object data={filePath} type="application/pdf" class="media p-2"><p>Browser does not support PDFs</p></object> -->
      <div bind:this={wrapper} class="w-100 pdf media">
        <PdfViewer
            url={filePath}
            {scale}
            showBorder={false}
            showButtons={[]} />
      </div>
    </div>
{:else}
      <div class="alert alert-warning p-2">Unsupported file type: {row.fileType}</div>
{/if}

<style>
 .result-card{
    height: max(150px,30vh);
    width:100%;
    display:flex;               /* keeps captionable future additions easy */
    justify-content:center;
    align-items:center;
    overflow:hidden;            /* clip anything that still spills */
    position:relative;
    cursor:pointer;
  }

  /* one rule for img, video, pdf object */
  .media{
    width:100%;
    height:100%;
    object-fit:contain;         /* scale down while preserving aspect */
    flex:1 1 auto;              /* fill the card, play nice with flexbox  */
  }

  .pdf {
    overflow:auto !important;
  }
</style>
