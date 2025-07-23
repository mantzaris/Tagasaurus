<script lang="ts">
import { Button, Col, Container, Icon, Input, Row,  TabContent, TabPane, Toast } from "@sveltestrap/sveltestrap";

let status: string|number = 'alpha';
let isOpen = $state(false);

async function upload() {
  const paths = await window.bridge.selectFiles();

  if (paths.length) {
    window.bridge.sendDroppedPaths(paths);
    isOpen = true;
  }
}

</script>

<div class="toast-container">
    <Toast autohide fade={true} duration={200} delay={1200} body {isOpen} on:close={() => (isOpen = false)}>
      <Icon name="upload" /> Import started...
    </Toast>
</div>


<Button color="primary" size="lg" href="/" class="ms-3 mt-3 mb-4">
    <Icon name="house-fill" class="fs-3"/>
</Button>


<Container fluid class="vh-100 d-flex p-2 gap-3 no-scroll">


    <TabContent  on:tab={(e) => (status = e.detail)}>

        <TabPane class="ms-4" tabId="Upload" tab="Upload" active>
            <br/>
            <div class="d-block d-md-none h-100">
                <h5>Upload media files: images / audio / video / PDF. You can also just drag-and-drop files & directories.</h5>
            </div>
            <div class="d-none d-md-block h-100 m-4">
                <h2>Upload media files: (images / audio / video / PDF). You can also just drag-and-drop files & directories.</h2>
            </div>
            <br/>

            <div class="d-flex justify-content-center">
                <Button color="primary" size="lg" onclick={upload}>
                <Icon name="file-arrow-up" class="fs-1" /> Upload Files
                </Button>
            </div>

        </TabPane>


        <TabPane tabId="Export" tab="Export">

            <h2 class="text-content">Bravo</h2>
            <img alt="Johnny Bravo" src="assets/images/Taga.png"/>
        
        </TabPane>


        <TabPane tabId="Import" tab="Import">

            <h2 class="text-content">Charlie</h2>
            <img alt="Charlie Brown" src="assets/images/Taga.png"/>

        </TabPane>


    </TabContent>

</Container>



<style>
  .toast-container {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 1050;
  }
</style>
