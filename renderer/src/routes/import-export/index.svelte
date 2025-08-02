<script lang="ts">
import SpinnerSimple from "$lib/components/SpinnerSimple.svelte";
  import { assignFreshImport } from "$lib/state/states.svelte";
import { clearSessionMediaCache } from "$lib/utils/temp-mediafiles";
import { Button, Col, Container, Icon, Input, Row,  TabContent, TabPane, Toast } from "@sveltestrap/sveltestrap";

import { url, goto } from '@roxi/routify';

let status: string|number = 'alpha';
let isOpen = $state(false);
let toastMessage = "";
let processingSpinner = $state(false);

async function upload() {
  const paths = await window.bridge.selectFiles();   

  if (paths.length) {
    window.bridge.sendDroppedPaths(paths);
    toastMessage = "Import Started..."
    isOpen = true;
  }
}


async function exportTaga() {
    processingSpinner = true;

    const success = await window.bridge.exportTagasaurus("tagasaurusExport.tar");      
        
    processingSpinner = false;
    success ? toastMessage = `Export Ok` : `Export Failed`;
    isOpen = true;
}


async function importTaga() {
    processingSpinner = true;

    const path = await window.bridge.importTagasaurus();
    
    processingSpinner = false;
    path ? toastMessage = `Import Ok at ${path}` : `Import Failed`;
    isOpen = true;

    await clearSessionMediaCache();
    await window.bridge.resetSamples();
    assignFreshImport(true);
}

const go = $goto;      // top-level access is allowed

function home() {
	go('/');           // navigate when the button is clicked
}
</script>


<div class="toast-container">
    <Toast autohide fade={true} duration={200} delay={1200} body {isOpen} on:close={() => (isOpen = false)}>
      <Icon name="upload" /> {toastMessage}
    </Toast>
</div>


<SpinnerSimple busy={processingSpinner} message="Processing..." color="rgba(0,255,128,.9)" block={true}/>


<Button color="primary" size="lg" on:click={home} class="ms-3 mt-3 mb-4">
    <Icon name="house-fill" class="fs-3"/>
</Button>


<Container fluid class="vh-80 d-flex p-2 gap-3 no-scroll">


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
            <br/>
            <div class="d-block d-md-none h-100">
                <h5>Tagasaurus Export: All your Tagasaurus data will be exported to the selected destination.</h5>
            </div>
            <div class="d-none d-md-block h-100 m-4">
                <h2>Tagasaurus Export: All your Tagasaurus data will be exported to the selected destination.</h2>
            </div>
            <br/>

            <div class="d-flex justify-content-center">
                <Button color="primary" size="lg" onclick={exportTaga}>
                <Icon name="database-fill-down" class="fs-1" /> Export Taga Data
                </Button>
            </div>           
        
        </TabPane>


        <TabPane tabId="Import" tab="Import">
            <br/>
            <div class="d-block d-md-none h-100">
                <h5>Tagasaurus Import: Select a Tagasaurus export to merge with your data. Warning make sure the export is good.</h5>
            </div>
            <div class="d-none d-md-block h-100 m-4">
                <h2>Tagasaurus Import: Select a Tagasaurus export to merge with your data. Warning make sure the export is good.</h2>
            </div>
            <br/>

            <div class="d-flex justify-content-center">
                <Button color="primary" size="lg" onclick={importTaga}>
                <Icon name="database-fill-add" class="fs-1" /> Import Taga Data
                </Button>
            </div>

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
