<script lang="ts">
    import ipc from "$lib/ipc";

    let electronVersion: string = $state("");
    let nodeVersion: string = $state("");
  
    let nodeVersionTxt = $derived(nodeVersion ? `Node: ${nodeVersion}` : "Node Version");
    let electronVersionTxt = $derived(
      electronVersion ? `Electron: ${electronVersion}` : "Electron Version",
    );
  
    async function getVersion(opt: "electron" | "node") {
      const version = await ipc.getVersion(opt);
  
      if (opt === "electron") {
        electronVersion = version;
      } else {
        nodeVersion = version;
      }
    }
</script>

<h1>Main Menu</h1>


<div class="buttons container">
    <button class="btn btn-primary" onclick={() => getVersion("node")}>{nodeVersionTxt}</button>
    <button>Foo</button>
    <button class="btn btn-primary" onclick={() => getVersion("electron")}>{electronVersionTxt}</button>
  </div>
  
<a href="/">Go to Test Page</a>

