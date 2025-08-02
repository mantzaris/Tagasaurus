<script lang="ts">
  import {Container, Row, Col, Button, Modal, ModalHeader, ModalBody, ModalFooter, Icon, Input} from '@sveltestrap/sveltestrap';
  import { onMount } from 'svelte';
  import { goto, url } from '@roxi/routify';

  let showConfirm = $state(false);
  let baseDataPath = $state('');
  let newDir      = $state('');

  onMount(async () => {
    baseDataPath = await window.bridge.getBaseDir(); 
  });

  //called when user clicks the 'Yes' button
  async function handleConfirm(dir: string) {
    const trimmed = dir.trim();
    
    if(!trimmed) {
        showConfirm = false;
        return;
    }

    const newBaseDir = await window.bridge.setBaseDir(dir); 
    console.log(newBaseDir);    
    showConfirm = false;
  }

  const go = $goto;      // top-level access is allowed

  function home() {
    go('/');           // navigate when the button is clicked
  }
</script>


<Container class="my-4">

    <Button color="primary" size="lg" on:click={home} class="mt-1 mb-4">
        <Icon name="house-fill" class="fs-3"/>
    </Button>
    
    <br>
    <hr>

    <Row class="mb-3 justify-content-center">
        <Col md="auto" class="mx-auto text-center">

        <h1 class="display-6">Change Path For Data Files</h1>
        
        <p>current data base path: {baseDataPath}</p>

        <p>Caution: this creates a new placement for where your files. If a Tagasaurus Files folder does not exist there a fresh new collection is created there. Data is not relocated and the app executable stays in the same location.</p>
        <Button color="primary" size="lg" on:click={() => (showConfirm = true)}>
            Change Data Path
        </Button>
        </Col>
    </Row>
</Container>



<Modal bind:isOpen={showConfirm} backdrop="static" keyboard={false} size="md">
  <ModalHeader toggle={() => (showConfirm = false)}>
    Please confirm
  </ModalHeader>

  <ModalBody>
    <p class="mb-3">
      Are you sure you want to apply this change? After you choose a new data
      directory (not the application directory) Tagasaurus will shutdown, restart it afterwards.
    </p>

    <Input type="text" placeholder="Enter new data directory path" bind:value={newDir}/>
  </ModalBody>

  <ModalFooter>
    <Button color="secondary" on:click={() => (showConfirm = false)}>
      Cancel
    </Button>
    <Button color="danger" on:click={() => handleConfirm(newDir)}>
      Yes, I am sure
    </Button>
  </ModalFooter>
</Modal>


