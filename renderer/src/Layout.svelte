<script lang="ts">
import { onMount } from 'svelte';
import { addNewFileHash } from '$lib/utils/localStorageManager';

onMount(() => {
  
  window.bridge.onNewMedia((hash: string) => {
    addNewFileHash(hash); 
  });

});

</script>

<slot />
