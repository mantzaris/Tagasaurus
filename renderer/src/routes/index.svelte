
<script lang="ts">
 
  // import { Container } from '@sveltestrap/sveltestrap';
  import { Container, Row, Col, Button, Card, CardBody, CardTitle, CardText, Navbar, NavbarBrand, Icon } from '@sveltestrap/sveltestrap';
    
  </script>
  


<Navbar   expand="md" style="background-color:var(--taga-color900);">
  <NavbarBrand href="#" ><strong>Tagasaurus</strong></NavbarBrand>
</Navbar>

<Container class="mt-4 p-4">

  <Row>
    <Col md="6" >
      <Card>
        <CardBody>
          <CardTitle>Gallery</CardTitle>
          <CardText>See your files, tag them, describe, and search as well.</CardText>
          <Button color="primary" outline size="lg" href="/tagging"><Icon name="hand-index-thumb-fill" /></Button>
        </CardBody>
      </Card>
    </Col>
    <Col md="6" xs="12">
      <Card>
        <CardBody>
          <CardTitle>Stream</CardTitle>
          <CardText>Use your webcam, or screen to search for people you know in real time.</CardText>
          <Button color="primary" outline size="lg" href="/streaming"><Icon name="hand-index-thumb-fill" /></Button>
        </CardBody>
      </Card>
    </Col>
  </Row>

  <Row class="mt-4">
    <Col md="4">
      <Card>
        <CardBody>
          <CardTitle >Face Explore</CardTitle>
          <CardText>Explore and search through faces in the media stored.</CardText>
          <Button color="primary" outline size="lg" href="/face-explore"><Icon name="hand-index-thumb-fill" /></Button>
        </CardBody>
      </Card>
    </Col>
    <Col md="4">
      <Card>
        <CardBody>
          <CardTitle >Upload / Export / Import</CardTitle>
          <CardText>Upload your files / Export your data to be used elsewhere / Import.</CardText>
          <Button color="primary" outline size="lg" href="/import-export"><Icon name="hand-index-thumb-fill" /></Button>
        </CardBody>
      </Card>
    </Col>

    <Col md="4">
      <Card>
        <CardBody>
          <CardTitle >Settings</CardTitle>
          <CardText>Configure Tagasaurus preferences.</CardText>
          <Button color="primary" outline size="lg"><Icon name="hand-index-thumb-fill" /></Button>
        </CardBody>
      </Card>
    </Col>
  </Row>
</Container>


