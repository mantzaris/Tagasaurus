import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

import routify from '@roxi/routify/vite-plugin' // import RoutifyPlugin from "@roxi/routify/vite-plugin";

import * as path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte(), routify()],
  base: "./", // Use relative paths for electron
  build: {
    outDir: "../dist/renderer/",
  },
  resolve: {
    alias: {
      // This line sets up the $lib alias
      $lib: path.resolve(__dirname, 'src/lib'),
    },
  },
});
