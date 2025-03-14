  <script>
    import { Button, Container, Row, Col, Card, CardImg, CardBody, CardTitle, CardText, Popover, Tooltip } from '@sveltestrap/sveltestrap';
  
    const image_asset_dir = "../../../assets/images/"

    const cardData = [
      { title: "Card1", img: image_asset_dir + "Taga.png", text: "This is card 1", link: "/card1" },
      { title: "Card2", img: image_asset_dir + "AristarchusOfSamos.jpg", text: "This is card 2", link: "/card2" },
      { title: "Card3", img: image_asset_dir + "Taga.png", text: "This is card 3", link: "/card3" },
      { title: "Card4", img: image_asset_dir + "Taga.png", text: "This is card 4" , link: "/card4" },
      { title: "Card5", img: image_asset_dir + "TheCats.jpg", text: "This is card 5", link: "/card5" },
      { title: "Card6", img: image_asset_dir + "JamesWebbSpaceTelescope.jpg", text: "This is card 6", link: "/card6" }
    ];
  </script>
  
  <Container>
    <!-- Small screens: vertical layout -->
    <div class="pt-3">
      <div class="d-block d-md-none mb-4">
        <div class="d-flex flex-column">
          <Button color="primary" class="mb-2 w-100">Button 1</Button>
          <Button color="secondary" class="w-100">Button 2</Button>
        </div>
      </div>
      <!-- Medium screens and up: horizontal layout -->
      <div class="d-none d-md-block mb-4">
        <Row class="align-items-center">
          <Col md="2" class="text-start">
            <Button color="primary" size="lg">Back</Button>
          </Col>
          <Col md="2" class="text-center">
            <Button color="primary" size="lg" style="white-space: nowrap;">New Random</Button>
          </Col>
        </Row>
      </div>
    </div>
       
    <Row>
   
      {#each cardData as card}
        <Col sm="12" md="6" lg="4" xl="3" class="mb-4">
          
          <Card id={card.title}>
            <CardImg top src={card.img} alt={card.title} class="p-2"/>
            <CardBody >
              <CardTitle>
                <Button  outline color="primary" size="md" href="/tagging/Taga.png">Select</Button>
              </CardTitle>
              <CardText>{card.text}</CardText>
            </CardBody>
          </Card>

        </Col>
      {/each}
    
    </Row>
  
  </Container>
  
<style>

</style>
  


