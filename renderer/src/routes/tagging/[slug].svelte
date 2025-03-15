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
  <div id="viewing" >
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
      <!-- Gallery Mode: Centered image only -->
      <!-- <Row class="vh-100 border border-primary border-3">
        <Col class="d-flex justify-content-center align-items-center">
          <Image fluid class="img-gallery" src={imageUrl} alt="Image view"   style="background-color:red;"/>
        </Col>
      </Row> -->
      <!-- <div id="screenshot" class="component-content"> -->
        <!-- Child container for the image -->
        <div id="center-gallery-area-div-id">
          <!-- svelte-ignore a11y_img_redundant_alt -->
          <img id="center-gallery-image-id" src={imageUrl} alt="Gallery Image" />
        </div>
        
      <!-- </div> -->
      
    {/if}
  </div>
</Container>

<style>
#viewing {
  background-color: yellow;
  height: 90%;
  width: 100vw;
}

#center-gallery-area-div-id {
  background-color: red;
  overflow: hidden;
  position: relative;
  
  /* For example, fill the remaining viewport (adjust the subtraction to your header's height) */
  height: 100%;
  width: 100%; /* or any desired width */
  margin: 0 auto;
  
  /* Use flexbox to center the image */
  display: flex;
  justify-content: center;
  align-items: center;
}

/* Image: force it to fill the container, scaling up if needed */
#center-gallery-image-id {
  width: 100%;
  height: 100%;
  object-fit: contain;  /* or 'cover' if you prefer cropping */
  display: block;
  background-color: blue;
}

@media (max-height: 400px) {
  
  
}

/* Medium viewport heights */
@media (min-height: 401px) and (max-height: 800px) {
  
  
}

/* Tall viewport heights */
@media (min-height: 801px) {
  
  
}

</style>


  
  