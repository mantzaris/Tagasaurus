<script lang="ts">

  let { imageUrl = '', fileType }: {imageUrl: string, fileType: string} = $props();
</script>

<!--<div id="viewing">
  <div id="viewing-container">
    <!~~ svelte-ignore a11y_img_redundant_alt ~~>
    <img id="viewing-image-id" src={imageUrl} alt="Gallery Image" />
  </div>
</div>-->


{#if fileType.startsWith('image/')}
  <div id="viewing">
    <div id="viewing-container">
      <!-- svelte-ignore a11y_img_redundant_alt -->
      <img id="viewing-image-id" class="" src={imageUrl} alt="Gallery Image" />
      <!-- <CardImg top src={imageUrl} alt={fileType} class="p-2"/> -->
    </div>
  </div>
{:else if fileType.startsWith('video/')}
  <div id="viewing">
    <div id="viewing-container">
      <!-- svelte-ignore a11y_media_has_caption -->
      <video id="viewing-video-id" controls preload="metadata" class="h-100 w-100 p-2">
        <source src={imageUrl} type={fileType} />
      </video>
    </div>
  </div>    
{:else if fileType.startsWith('audio/')}
  <div id="viewing">
    <div id="viewing-container">
      <audio id="viewing-audio-id" controls preload="metadata" class="w-100 p-2">
        <source src={imageUrl} type={fileType} />
      </audio>
    </div>
  </div>      
{:else if fileType.startsWith('application/pdf')}
  <div id="viewing">
    <div id="viewing-container">      
      <!-- svelte-ignore a11y_missing_attribute -->
      <object id="viewing-pdf-id" data={imageUrl} type="application/pdf" class="w-100 p-2"><p>Browser does not support PDFs</p></object>
      <!-- <embed src={filePath} type="application/pdf" class="w-100"/> -->
      <!-- <iframe src={filePath} class="w-100">Fallback content</iframe> -->
    </div>
  </div>
{:else}
      <div class="alert alert-warning p-2">Unsupported file type: {fileType}</div>
    {/if}

<style>
  #viewing {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  #viewing-container {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  #viewing-image-id, #viewing-video-id {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  #viewing-audio-id {
    width: 100%;
    height: 50% !important;
    object-fit: contain;
  }
  #viewing-pdf-id {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
</style>