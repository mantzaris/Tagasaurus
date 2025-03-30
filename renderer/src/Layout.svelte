<script lang="ts">


    window.bridge.onTestMain2((data:string) => {
      console.log("Received in renderer:", data);
      // You could also do something like:
      // document.getElementById('my-output').innerText = data;
    });

    console.log("layout")

</script>


<slot />

