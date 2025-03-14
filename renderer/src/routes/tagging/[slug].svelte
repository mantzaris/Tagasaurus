<script lang="ts">
  import { Container, Row, Col, Button, Input, Icon } from '@sveltestrap/sveltestrap';
  import { params, goto } from '@roxi/routify';
  
    // Retrieve the slug from Routify's $params store
    let { slug } = $params;
    console.log(slug)

    let imageUrl = "../../../assets/images/WebTransportDatagramDuplexStream.png";

    let description = "hi";

</script>


<Container class="py-2">

  <!-- Layout for extra-small screens -->
  <div class="d-block d-sm-none">
    <!-- Top row: Back and Delete -->
    <Row class="mb-2 align-items-center">
      <Col xs="6" class="d-flex justify-content-start">
        <Button color="primary" size="sm"><Icon name="house-fill" class="fs-4"/></Button>

        <Input type="select" class="w-auto ms-2">
          {#each ["edit", "gallery"] as option}
            <option>{option}</option>
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
        
        <Input type="select" class="w-auto ms-4">
          {#each ["edit", "gallery"] as option}
            <option>{option}</option>
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
  <Row class="mb-3">
    <Col>
      <!-- Using the img-fluid class ensures the image scales nicely -->
      <img src={imageUrl} alt="Descriptive image" class="img-fluid" />
    </Col>
  </Row>

  <!-- Text area for the image description -->
  <Row class="mb-2">
    <Col>
      <Input
        type="textarea"
        placeholder="Enter image description..."
        bind:value={description}
        
      />
    </Col>
  </Row>

  <!-- Save button below the text area -->
  <Row>
    <Col class="text-end">
      <Button color="success" size="md">Save</Button>
    </Col>
  </Row>
</Container>



  
  