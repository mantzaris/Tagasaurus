<script lang="ts">
import CardMedia from './../../lib/components/CardMedia.svelte';
import { getMediaDir } from '$lib/utils/localStorageManager';
import { buildCombinedEntries } from '$lib/utils/select-cards';
import { getMediaFilePath } from '$lib/utils/utils';
import { Button, Container, Row, Col, Card, CardImg, CardBody, CardTitle, CardText, Popover, Tooltip , Icon} from '@sveltestrap/sveltestrap';
import { onMount } from 'svelte';

import { type MediaFile } from '$lib/types/general-types';
import { fillSampleMediaFiles, getNewMediaFiles } from '$lib/utils/temp-mediafiles';
  

let mediaDir = $state("");
let newMedia: MediaFile[] = [];
let sampleMedia: MediaFile[] = [];

let cardData:MediaFile[] = $state([]);

onMount(async () => {
  mediaDir = await getMediaDir();
  setCards();
})

async function setCards() {
  if( newMedia.length == 0 || sampleMedia.length == 0 || Math.random() < 0.2 ) {
    newMedia = await getNewMediaFiles();
    sampleMedia = await fillSampleMediaFiles();
  }
  
  if( newMedia.length > 0 || sampleMedia.length > 0 ) {
    cardData = buildCombinedEntries(newMedia, sampleMedia, 10);
  }  
}

function truncateDescription(description: string): string {
  if (description.length <= 40) {
    return description;
  }
  return description.slice(0, 40);
}

</script>

<Container>
  <!-- Small screens: vertical layout -->
  <div class="pt-3">
    <div class="d-block d-md-none mb-4">
      <div class="d-flex flex-row justify-content-evenly">
        <Button color="primary" class="w-25" href="/"><Icon name="house-fill" class="fs-4"/></Button>
        <Button id="btn-dice-sm" color="primary" class="w-25" on:click={setCards}><Icon name="dice-5-fill"/></Button>
        <Tooltip target="btn-dice-sm" placement="right">See New</Tooltip>
      </div>
    </div>
    
    <!-- Medium screens and up: horizontal layout -->
    <div class="d-none d-md-block mb-4">
      <Row class="align-items-center">
        <Col md="2" class="text-start">
          <Button color="primary" size="lg" href="/"><Icon name="house-fill" class="fs-4"/></Button>
        </Col>
        <Col md="2" class="text-center">
          <Button id="btn-dice-md" color="primary" size="lg" style="white-space: nowrap;" on:click={setCards}><Icon name="dice-5-fill" /></Button>
          <Tooltip target="btn-dice-md" placement="right">See New</Tooltip>
        </Col>
      </Row>
    </div>
  </div>

  <Row>

    {#if cardData.length > 0}
      {#each cardData as card}
        <Col sm="12" md="6" lg="4" xl="3" class="mb-4">
          
          <Card id={card.fileHash}>

            <CardMedia filePath={"file://" + getMediaFilePath(mediaDir,card.fileHash)} fileType={card.fileType} />
            
            <CardBody >
              <CardTitle>
                <Button  outline color="primary" size="md" href="/tagging/Taga.png"><Icon name="hand-index-thumb-fill" /></Button>
              </CardTitle>
              <CardText>{truncateDescription(card.description)}</CardText>
            </CardBody>
          </Card>

        </Col>
      {/each}
    {:else}
        <h2>Empty, add files.</h2>
    {/if}

  
  </Row>

</Container>
  

  


