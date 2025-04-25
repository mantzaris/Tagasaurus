import { env } from '@huggingface/transformers';

env.allowLocalModels  = true;
env.allowRemoteModels = false;
env.localModelPath    = '/assets/models';

(env as any).backends ??= {};
(env as any).backends.webgpu = { disable: true };

const backends: any = (env as any).backends ?? ((env as any).backends = {});
backends.webgpu = { disable: true };  

const be: any = (env as any).backends ?? ((env as any).backends = {});
be.wasm = {
  wasmPaths: '/assets/ort/',
  proxy: false,
  numThreads: navigator.hardwareConcurrency ?? 4,
};

//export exactly once, since every later import sees the configured singleton
export { env };
