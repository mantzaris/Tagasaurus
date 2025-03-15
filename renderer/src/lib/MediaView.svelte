<script lang="ts">
  let { imageUrl = '' } = $props();
</script>

<div id="viewing">
  <div id="viewing-container">
    <!-- svelte-ignore a11y_img_redundant_alt -->
    <img id="viewing-image-id" src={imageUrl} alt="Gallery Image" />
  </div>
</div>

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
  #viewing-image-id {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
</style>