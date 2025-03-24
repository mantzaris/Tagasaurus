
<script lang="ts"> 
    // import { Container } from '@sveltestrap/sveltestrap';
    import { Container, Row, Col, Button, Card, CardBody, CardTitle, CardText, Navbar, NavbarBrand } from '@sveltestrap/sveltestrap';

  </script>
  
  <!-- <main style="background-color: green;">
 
    <i class="fa-solid fa-house"></i>

    <a href="/main-menu">main</a>
 
    </main> -->


<Navbar   expand="md" style="background-color:var(--taga-color900);">
  <NavbarBrand href="#" >Tagasaurus</NavbarBrand>
</Navbar>

<Container class="mt-4 p-4">
  
  <Row>
    <Col md="6" >
      <Card>
        <CardBody>
          <CardTitle>Gallery</CardTitle>
          <CardText>See your files, tag them, describe, and search as well. You can also import files one at a time by drag and drop.</CardText>
          <Button color="primary" size="lg" href="/tagging">Open</Button>
        </CardBody>
      </Card>
    </Col>
    <Col md="6" xs="12">
      <Card>
        <CardBody>
          <CardTitle >Stream</CardTitle>
          <CardText>Use your webcam, or screen to search for people you know in real time or capture and save images/video.</CardText>
          <Button color="primary" size="lg">Open</Button>
        </CardBody>
      </Card>
    </Col>
  </Row>

  <Row class="mt-4">
    <Col md="4">
      <Card>
        <CardBody>
          <CardTitle >Face Map</CardTitle>
          <CardText>Explore and search through faces in the media stored.</CardText>
          <Button color="primary" size="lg">Open</Button>
        </CardBody>
      </Card>
    </Col>
    <Col md="4">
      <Card>
        <CardBody>
          <CardTitle >Export / Import</CardTitle>
          <CardText>Export your data to be used elsewhere or uploaded, or import new data.</CardText>
          <Button color="primary" size="lg">Open</Button>
        </CardBody>
      </Card>
    </Col>

    <Col md="4">
      <Card>
        <CardBody>
          <CardTitle >Settings</CardTitle>
          <CardText>Configure Tagasaurus preferences.</CardText>
          <Button color="primary"  size="lg">Open</Button>
        </CardBody>
      </Card>
    </Col>
  </Row>
  <Button color="primary" size="lg" href="/main-menu">Open</Button>
</Container>


