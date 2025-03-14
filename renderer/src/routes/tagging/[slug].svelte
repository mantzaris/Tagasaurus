<script lang="ts">

    import { Button } from '@sveltestrap/sveltestrap';

    import { params, goto } from '@roxi/routify';
  
  
    // Retrieve the slug from Routify's $params store
    let { slug } = $params;
  
    console.log(slug)
  </script>
  
  <Button color="primary" size="lg" href='/tagging'>Open</Button>
  
  
  