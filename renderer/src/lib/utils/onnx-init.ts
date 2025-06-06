import * as ort from 'onnxruntime-web';

// Configure ONNX Runtime paths
export function initializeOnnxRuntime() {
  // Set the path for WASM files
  ort.env.wasm.wasmPaths = '/assets/ort/';
  
  // Disable WebGPU if you're having issues
  ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;
  ort.env.wasm.simd = true;
  
  // Set execution providers priority
  ort.env.webgl.contextId = 'webgl2';
  
  console.log('ONNX Runtime initialized with paths:', {
    wasmPaths: ort.env.wasm.wasmPaths,
    numThreads: ort.env.wasm.numThreads
  });
}

export { ort };