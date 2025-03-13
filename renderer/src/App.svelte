<script lang="ts">
  import { Router, createRouter } from '@roxi/routify'
  import routes from '../.routify/routes.default.js'
  export const router = createRouter({ routes })

  import { Styles } from '@sveltestrap/sveltestrap';

</script>

<!-- need? -->
<Styles/> 

<Router {router} />

