<script lang="ts">
import CardMedia from './../../lib/components/CardMedia.svelte';
import { getMediaDir } from '$lib/utils/localStorageManager';
import { buildCombinedEntries } from '$lib/utils/select-cards';
import { getMediaFilePath } from '$lib/utils/utils';
import { Button, Container, Row, Col, Card, CardImg, CardBody, CardTitle, CardText, Popover, Tooltip , Icon, Spinner} from '@sveltestrap/sveltestrap';
import { getContext, onMount } from 'svelte';

import { type MediaFile } from '$lib/types/general-types';
import { fillSampleMediaFiles, getNewMediaFiles } from '$lib/utils/temp-mediafiles';
  import { assignFreshImport, freshImport } from '$lib/state/states.svelte';
  import { goto, url } from '@roxi/routify';


let mediaDir: string = $state(getContext('mediaDir')); 

let newMedia: MediaFile[] = [];
let sampleMedia: MediaFile[] = [];
let cardData:MediaFile[] = $state([]);
let isMounting: boolean = $state(true);

let isProcessing = $state(false);


onMount(async () => {
  console.log("cards mounting");
  mediaDir = await getMediaDir();

  console.log(`is FeshImport = ${freshImport.value}`);
  if(freshImport.value) {
    newMedia = [];
    sampleMedia = [];
    assignFreshImport(false);
    await setCards();
  }

  

  await setCards();
  isMounting = false;
});

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

const go = $goto;      // top-level access is allowed

function home() {
	go('/');           // navigate when the button is clicked
}
</script>

<Container>
  <!-- Small screens: vertical layout -->
  <div class="pt-3">
    <div class="d-block d-md-none mb-4">
      <div class="d-flex flex-row justify-content-evenly">
        <Button color="primary" class="w-25" on:click={home}><Icon name="house-fill" class="fs-4"/></Button>
        <Button disabled={isProcessing} id="btn-dice-sm" color="primary" class="w-25" on:click={setCards}><Icon name="dice-5-fill"/></Button>
        <Tooltip target="btn-dice-sm" placement="bottom">See New</Tooltip>
      </div>
    </div>
    
    <!-- Medium screens and up: horizontal layout -->
    <div class="d-none d-md-block mb-4">
      <Row class="align-items-center">
        <Col md="2" class="text-start">
          <Button color="primary" size="lg" on:click={home}><Icon name="house-fill" class="fs-4"/></Button>
        </Col>
        <Col md="2" class="text-center">
          <Button disabled={isProcessing} id="btn-dice-md" color="primary" size="lg" style="white-space: nowrap;" on:click={setCards}><Icon name="dice-5-fill" /></Button>
          <Tooltip target="btn-dice-md" placement="right">Get New</Tooltip>
        </Col>
      </Row>
    </div>
  </div>

  <Row>
    {#if isMounting}
      <Col class="d-flex justify-content-center align-items-center">
        <Spinner type="border" color="primary"/>
      </Col>
    {:else}
      {#if cardData.length > 0}
        {#each cardData as card}
          <Col sm="12" md="6" lg="4" xl="3" class="mb-4">
            
            <Card id={card.fileHash}>

              <CardMedia filePath={getMediaFilePath(mediaDir,card.fileHash)} fileType={card.fileType} />
              
              <CardBody >
                <CardTitle>
                  <Button 
                    outline 
                    color="primary" 
                    size="md" 
                    href={$url(`/tagging/[slug]`, {slug: card.fileHash, fileType: encodeURIComponent(card.fileType)})}>
                    <Icon name="hand-index-thumb-fill" />
                  </Button>
                </CardTitle>
                <CardText>{truncateDescription(card.description)}</CardText>
              </CardBody>
            </Card>

          </Col>
        {/each}
      {:else}
          <h2>Empty, add files.</h2>
      {/if}
    {/if}
  
  </Row>

</Container>
  
<style>


</style>
