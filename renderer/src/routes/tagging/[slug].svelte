<script lang="ts">
  import { Container, Row, Col, Button, Input, Icon, Image } from '@sveltestrap/sveltestrap';
  import { params, goto } from '@roxi/routify';
  
    // Retrieve the slug from Routify's $params store
    let { slug } = $params;
    console.log(slug)

    let imageUrl = "../../../assets/images/Taga.png";

    let description = "hi";
    let mode: "edit" | "gallery" = "gallery";
</script>


<Container fluid class="d-flex flex-column vh-100 p-0 m-0">

  <!-- Layout for extra-small screens -->
  <div class="d-block d-sm-none">
    <!-- Top row: Back and Delete -->
    <Row class="mb-2 align-items-center">
      <Col xs="6" class="d-flex justify-content-start">
        <Button color="primary" size="sm"><Icon name="house-fill" class="fs-4"/></Button>

        <Input type="select" class="w-auto ms-1 me-2" bind:value={mode}>
          {#each ["edit", "gallery"] as option}
            <option value={option}>{option}</option>
          {/each}
        </Input>
      </Col>
      <Col xs="6" class="d-flex justify-content-end">
        <Button color="danger" size="sm"><Icon name="x-square-fill" class="fs-4"/></Button>
      </Col>
    </Row>
    <!-- Bottom row: Center group -->
    <Row class="mb-2">
      <Col class="d-flex justify-content-center gap-2">
        <Button color="primary" size="sm"><Icon name="caret-left-fill" class="fs-4"/></Button>
        <Button color="primary" size="sm"><Icon name="search" class="fs-4"/></Button>
        <Button color="primary" size="sm"><Icon name="caret-right-fill" class="fs-4"/></Button>
      </Col>
    </Row>
  </div>

  <!-- Layout for small screens and up -->
  <div class="d-none d-sm-block">
    <Row class="mb-2 align-items-center">
      <Col xs="4" class="d-flex justify-content-start">
        <Button color="primary" size="md"><Icon name="house-fill" class="fs-3"/></Button>
        
        <Input type="select" class="w-auto ms-2 me-2" bind:value={mode}>
          {#each ["edit", "gallery"] as option}
            <option value={option}>{option}</option>
          {/each}
        </Input>

      </Col>
      <Col xs="4" class="d-flex justify-content-center gap-3">
        <Button color="primary" size="md"><Icon name="caret-left-fill" class="fs-3"/></Button>
        <Button color="primary" size="md"><Icon name="search" class="fs-3"/></Button>
        <Button color="primary" size="md"><Icon name="caret-right-fill" class="fs-3"/></Button>
      </Col>
      <Col xs="4" class="d-flex justify-content-end">
        <Button color="danger" size="md"><Icon name="x-square-fill" class="fs-3"/></Button>
      </Col>
    </Row>
  </div>

  
  <!-- Image display area using Sveltestrap styling for images -->
  <!-- #TODO: gallery view as component -->
  
    {#if mode === "edit"}
      <!-- Edit Mode: Two columns -->
      <Row class="h-100">
        <!-- Left column: description and save button -->
        <Col sm="6" class="d-flex flex-column justify-content-center p-3">
          <textarea 
            class="form-control mb-3" 
            placeholder="Enter description..." 
            style="min-height: 150px; background-color:aqua;"
          ></textarea>
          <Button color="success" size="md">Save</Button>
        </Col>
        <!-- Right column: image view -->
        <Col sm="6" class="d-flex justify-content-center align-items-center p-3">
          <Image fluid src={imageUrl} alt="Image view" style="background-color:red;" />
        </Col>
      </Row>
    {:else if mode === "gallery"}
      <div id="viewing" >
        <!-- Child container for the image -->
        <div id="viewing-container">
          <!-- svelte-ignore a11y_img_redundant_alt -->
          <img id="viewing-image-id" src={imageUrl} alt="Gallery Image" />
        </div>     
      </div>
    {/if}
  

</Container>

<style>
  #viewing {
  box-sizing: border-box; /*optional*/
  padding: 2px; /*optional*/
  /* Make #viewing take all leftover space below the header area */
  flex: 1 1 auto;  /* This is critical to fill leftover vertical space in a flex column */

  /* Use flex to easily center or position its contents if needed */
  display: flex;
  flex-direction: column; 
  overflow: hidden; /* so we don't get scrollbars if there's small mismatch */
  width: 100%;
}
#viewing-container {
  background-color: red;
  position: relative;

  /* Let it expand to fill #viewing’s space */
  flex: 1 1 auto;
  display: flex;
  justify-content: center;
  align-items: center;
  
  width: 100%;
  /* We let the flex layout handle the height. If you prefer an explicit height: 100%; 
     it should work as long as #viewing has a definite height. */
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
  background-color: blue;
}


</style>


