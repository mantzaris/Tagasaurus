<script lang="ts">
  import { Router, createRouter } from '@roxi/routify'
  import routes from '../.routify/routes.default.js'
  export const router = createRouter({ 
    routes,
    urlRewrite: {
      toExternal: url =>  url === '/' ? '#/' : `#${url}`,         // internal "/route" → "#/route"
      toInternal: url => url.replace(/^.+#/, '')  ||  '/'  // "#/route" → "/route"
    }
  })

  // import { Styles } from '@sveltestrap/sveltestrap';

  import Layout from './Layout.svelte';



</script>

<!-- need? -->
<!-- <Styles/>  -->

<Layout>
  <Router {router} />
</Layout>
