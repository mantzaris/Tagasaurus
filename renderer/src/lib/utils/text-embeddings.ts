import { pipeline, env, type FeatureExtractionPipeline, type Tensor } from '@huggingface/transformers';
import { meanPool } from './ml-utils';
import { getContext } from 'svelte';

env.allowLocalModels = true;
env.allowRemoteModels = false; // refuse any HTTP download
env.localModelPath  = '/assets/models';
const MODEL_LOCAL_PATH = 'sentence-transformers/all-MiniLM-L6-v2';
//const MODEL_PATH = '../../../assets/models/sentence-transformers/all-MiniLM-L6-v2';
// (env as any).backends.wasm.wasmPaths = '/assets/ort/';


const be: any = (env as any).backends ?? ((env as any).backends = {});
const wasm    = be.wasm        ?? (be.wasm = {});
wasm.wasmPaths  = '/assets/ort/';
wasm.numThreads = navigator.hardwareConcurrency ?? 4;


type Device = 'gpu' | 'wasm';   // we no longer expose 'webgpu'
const extractorCache = new Map<Device, Promise<FeatureExtractionPipeline>>();

function getExtractor(device: Device): Promise<FeatureExtractionPipeline> {
  const cached = extractorCache.get(device);
  if (cached) return cached;

  const promise = pipeline<'feature-extraction'>(
    'feature-extraction',
    MODEL_LOCAL_PATH,
    { device, dtype: 'fp32' }          // just 'gpu' or 'wasm'
  );
  extractorCache.set(device, promise);
  return promise;
}
// let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

// async function getExtractor(): Promise<FeatureExtractionPipeline> {
//   return extractorPromise ??=
//     pipeline<'feature-extraction'>(
//       'feature-extraction',
//       MODEL_LOCAL_PATH,
//       { dtype: 'fp32' }
//     );
// }

/* helper: always returns Float32Array[] */
// export async function embedText(text: string | string[]) {return 'hody'}
export async function embedText(text: string | string[], device: Device ): Promise<Float32Array[]> {
  console.log('HF active backend =', env.backends);   // → 'wasm'  
  const extractor = await getExtractor(device);

    const inputs = Array.isArray(text) ? text : [text];
    const vectors: Float32Array[] = [];

    for (const sentence of inputs) {
      const tensor = await extractor(sentence);
      vectors.push(meanPool(tensor as Tensor));
    }
    return vectors;
}



//TODO: in dev also import 'env' and do, 'env.useBrowserCache = false;'
/**
 * OPTIONAL – turn off the WASM/ONNX browser cache in dev only.
 * Remove or wrap in `if (import.meta.env.DEV)` for production.
 */
// env.useBrowserCache = false;