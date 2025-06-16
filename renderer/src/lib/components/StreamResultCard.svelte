<script lang="ts">
  import { getMediaFilePath } from '$lib/utils/utils';
  import type { SearchRow } from '$lib/types/general-types';
  import { getContext } from 'svelte';

  export let row: SearchRow = {
    fileHash: '281fe476540dff58cf5fdabec0e79a5fec6018feb1e79cdbdb2849b375aeb802',
    fileType: 'image/jpeg',
    description: null
  };

  const mediaDir: string = getContext('mediaDir') ?? '';
  console.log("fdsf"+mediaDir)
  const filePath = getMediaFilePath(mediaDir, row.fileHash);

</script>


{#if row.fileType.startsWith('image/')}
  <div class="result-card mb-2">
    <img class="media" src={filePath} alt="Gallery image" />
  </div>

{:else if row.fileType.startsWith('video/')}
  <div class="result-card mb-2">
    <video controls preload="metadata" class="media">
      <source src={filePath} type={row.fileType} />
    </video>
  </div>

{:else}
  Unsupported file type
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
    /* flex:1 1 auto;              fill the card, play nice with flexbox  */
  }

</style>
