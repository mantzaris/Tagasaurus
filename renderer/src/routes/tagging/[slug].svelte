<script lang="ts">
  import { Container, Row, Col, Button, Input, Icon, Image } from '@sveltestrap/sveltestrap';
  import { params, goto } from '@roxi/routify';

  // import MyComponent from '$lib/MyComponent.svelte';
  import MediaView from '$lib/MediaView.svelte';
  
    // Retrieve the slug from Routify's $params store
    let { slug } = $params;
    console.log(slug)

    let imageUrl = "../../../assets/images/Taga.png";

    let description = "hi";
    let mode: "edit" | "gallery" = "gallery";
</script>


<Container fluid class="d-flex flex-column vh-100 p-0 m-0">
  <!-- <MyComponent name="Tester" /> -->
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
        <MediaView imageUrl={imageUrl} />
      </Col>
    </Row>
  {:else if mode === "gallery"}
    <MediaView imageUrl={imageUrl} />
  {/if}


</Container>

<style>
</style>


