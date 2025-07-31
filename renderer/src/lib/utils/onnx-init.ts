import * as ort from 'onnxruntime-web';
import { env } from 'onnxruntime-web';




env.useBrowserCache = false;
const MODEL_PATH_DETECTION = '/assets/models/buffalo_l/det_10g.onnx'; //also scrfd10Gkps/scrfd_10g_bnkps.onnx';//https://huggingface.co/ByteDance/InfiniteYou/resolve/main/supports/insightface/models/antelopev2/scrfd_10g_bnkps.onnx
const MODEL_PATH_EMBEDDING = '/assets/models/buffalo_l/w600k_r50.onnx';


// Configure ONNX Runtime paths
export async function initializeOnnxRuntime() {
  const assetPath = await window.bridge.getAssetPath(); 
  console.log(`asset path = ${assetPath}`);

  const MODEL_PATH_DETECTION_LOCAL = assetPath + MODEL_PATH_DETECTION;
  const MODEL_PATH_EMBEDDING_LOCAL = assetPath + MODEL_PATH_EMBEDDING


  env.useBrowserCache = false;

  const detectSession = await ort.InferenceSession.create(MODEL_PATH_DETECTION_LOCAL, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });
    
  const embedSession = await ort.InferenceSession.create(MODEL_PATH_EMBEDDING_LOCAL, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all'
  });

  return {detectSession, embedSession}
}

export { ort, env };