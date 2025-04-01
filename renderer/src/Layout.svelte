<script lang="ts">

import { onMount } from 'svelte';

let newFiles = [];
  
onMount(() => {
  window.bridge.onNewMedia((hash:string) => {
    newFiles.push(hash);

    console.log(hash)
  });
});

</script>

<slot />
