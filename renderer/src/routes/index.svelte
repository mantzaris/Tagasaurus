
<script lang="ts"> 
    // import { Container } from '@sveltestrap/sveltestrap';
    import { Container, Row, Col, Button, Card, CardBody, CardTitle, CardText, Navbar, NavbarBrand, Modal, ModalHeader, ModalBody, ModalFooter } from '@sveltestrap/sveltestrap';

  </script>
  
  <!-- <main style="background-color: green;">
 
    <i class="fa-solid fa-house"></i>

    <a href="/main-menu">main</a>
 
    </main> -->


<Navbar color="dark" dark expand="md">
  <NavbarBrand href="#">Tagasaurus</NavbarBrand>
</Navbar>


    <Container class="mt-4">
      <Row>
        <Col md="4">
          <Card>
            <CardBody>
              <CardTitle >Import Files</CardTitle>
              <CardText>Upload images for annotation.</CardText>
              <Button color="primary" >Open</Button>
            </CardBody>
          </Card>
        </Col>
        <Col md="4">
          <Card>
            <CardBody>
              <CardTitle >Describe Images</CardTitle>
              <CardText>Tag and describe your images.</CardText>
              <Button color="primary" >Open</Button>
            </CardBody>
          </Card>
        </Col>
        <Col md="4">
          <Card>
            <CardBody>
              <CardTitle >Export / Search</CardTitle>
              <CardText>Find and export your annotations.</CardText>
              <Button color="primary" >Open</Button>
            </CardBody>
          </Card>
        </Col>
      </Row>
      <Row class="mt-4">
        <Col md="6">
          <Card>
            <CardBody>
              <CardTitle >Webcam Analysis</CardTitle>
              <CardText>Analyze live images from your webcam.</CardText>
              <Button color="primary" >Open</Button>
            </CardBody>
          </Card>
        </Col>
        <Col md="6">
          <Card>
            <CardBody>
              <CardTitle >Settings</CardTitle>
              <CardText>Configure application preferences.</CardText>
              <Button color="primary" >Open</Button>
            </CardBody>
          </Card>
        </Col>
      </Row>
    </Container>
  