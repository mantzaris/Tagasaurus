<script lang="ts">
    // 1) Destructure the props
    // 2) Provide a fallback if none is passed from the parent component
    let { imageUrl = '' } = $props();
  
    
  </script>
  
  <!-- Main wrapper -->
  <div id="viewing">
    <!-- Child container for the image -->
    <div id="viewing-container">
      <!-- svelte-ignore a11y_img_redundant_alt -->
      <img id="viewing-image-id" src={imageUrl} alt="Gallery Image" />
    </div>
  </div>
  
  <style>
    #viewing {
        background-color: red;
      box-sizing: border-box; /* optional */
      padding: 2px; /* optional */
  
      /* Make #viewing take all leftover space below the header area */
      flex: 1 1 auto; /* critical if you're in a flex-based layout */
  
      display: flex;
      flex-direction: column;
      overflow: hidden; /* so we don't get scrollbars if there's a small mismatch */
      width: 100%;
    }
  
    #viewing-container {
      position: relative;
  
      /* Let it expand to fill #viewing’s space */
      flex: 1 1 auto;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      /* If you prefer an explicit height: 100%, 
         ensure #viewing has a definite height in a parent container. */
      overflow: hidden;
    }
  
    #viewing-image-id {
      /* Force the rendered box of the image to be the full size of the parent div. */
      width: 100%;
      height: 100%;
  
      /* Maintain the aspect ratio without cropping. 
         This ensures no overflow, but you may see letterboxing/pillarboxing. */
      object-fit: contain;
      display: block;
    }
  </style>
  