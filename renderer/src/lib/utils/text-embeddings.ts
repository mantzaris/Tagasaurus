import '$lib/utils/transformers-init';

import { pipeline, type FeatureExtractionPipeline, type Tensor } from '@huggingface/transformers';
import { meanPool } from './ml-utils';
import type { DeviceGPU } from '$lib/types/general-types';

const MODEL_LOCAL_PATH = 'sentence-transformers/all-MiniLM-L6-v2';

const extractorCache = new Map<DeviceGPU, Promise<FeatureExtractionPipeline>>();

function getExtractor(device: DeviceGPU): Promise<FeatureExtractionPipeline> {
  const cached = extractorCache.get(device);
  if (cached) return cached;

  const promise = pipeline<'feature-extraction'>(
    'feature-extraction',
    MODEL_LOCAL_PATH,
    { device, dtype: 'fp32' } //just 'gpu' or 'wasm', no webgpu allowed yet
  );
  extractorCache.set(device, promise);
  return promise;
}

/* helper: always returns Float32Array[] */
// export async function embedText(text: string | string[]) {return 'hody'}
export async function embedText(
  text: string | string[],
  device: DeviceGPU
): Promise<Float32Array[]> {

  const sentences = Array.isArray(text) ? text : [text];
  const vectors: Float32Array[] = [];

  for (const s of sentences) {
    const extractor = await getExtractor(device);
    const t = await extractor(s);
    vectors.push(meanPool(t as Tensor));
    t.dispose();//free RAM/VRAM
  }
  return vectors;
}



//TODO: in dev also import 'env' and do, 'env.useBrowserCache = false;'
/**
 * OPTIONAL – turn off the WASM/ONNX browser cache in dev only.
 * Remove or wrap in `if (import.meta.env.DEV)` for production.
 */
// env.useBrowserCache = false;