import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

import routify from '@roxi/routify/vite-plugin' // import RoutifyPlugin from "@roxi/routify/vite-plugin";

import * as path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte(), routify({ router: 'hash' })],
  base: "./", // Use relative paths for electron
  build: {
    outDir: "../dist/renderer/",
    // rollupOptions: {
      // Routify 3 otherwise tucks everything under /client
    //   output: { dir: "../dist/renderer" }
    // }
  },
  resolve: {
    alias: {
      // This line sets up the $lib alias
      $lib: path.resolve(__dirname, 'src/lib'),
    },
  },
  server: {
    headers: {
      // Ensure proper MIME types for WASM files
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web']
  },
  assetsInclude: ['**/*.wasm', '**/*.onnx'],
});
