<script lang="ts">
    import { Button } from '@sveltestrap/sveltestrap';

    let mediaFiles = [11,222,33333];
 
    
  </script>
  
  <h1>Gallery</h1>
  <div class="gallery-grid">

    {#each mediaFiles as media}
        <div class="gallery-item" >
                        
            <Button color="primary" size="lg" href={'/tagging/'+media}>Open</Button>

        </div>
    {/each}

</div>
  
  <style>
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
    }
    .gallery-item {
      cursor: pointer;
      text-align: center;
      border: 1px solid #ddd;
      padding: 0.5rem;
      transition: transform 0.2s;
    }
    .gallery-item:hover {
      transform: scale(1.02);
    }
    
  </style>
  