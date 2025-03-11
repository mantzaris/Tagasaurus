<script lang="ts">
  import Test from "./routes/Test.svelte";
  import MainMenu from "./routes/main-menu/MainMenu.svelte";

  const routes = {
    "/test": Test,
    "/main-menu": MainMenu,

    "*": MainMenu
  };

</script>

<main>



  FOOBAR BAZ
  <i class="fa-solid fa-house"></i>

</main>
