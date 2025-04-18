import { pipeline, env, type FeatureExtractionPipeline, type Tensor } from '@xenova/transformers';
import { meanPool } from './ml-utils';

env.allowLocalModels = true;               // ← tell the loader “local OK”
env.localModelPath  = '/assets/models';    // ← root of your mirror
const MODEL_LOCAL_PATH = 'sentence-transformers/all-MiniLM-L6-v2';
//const MODEL_PATH = '../../../assets/models/sentence-transformers/all-MiniLM-L6-v2';

/* singleton */
let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;
async function getExtractor() {
  return (
    extractorPromise ??=
      pipeline('feature-extraction', MODEL_LOCAL_PATH, { quantized: false })
  );
}

/* helper: always returns Float32Array[] */
// export async function embedText(text: string | string[]) {return 'hody'}
export async function embedText(text: string | string[]): Promise<Float32Array[]> {
    const extractor = await getExtractor();
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