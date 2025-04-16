import { pipeline } from '@xenova/transformers';

(async () => {
  // Add `quantized: false` to avoid searching for "model_quantized.onnx"
  const extractor = await pipeline(
    'feature-extraction',
    'sentence-transformers/all-MiniLM-L6-v2',
    { quantized: false }  
  );

  const result = await extractor('Test sentence to ensure the model is fully cached.');
  console.log('Done. Model should now be cached locally.', result);
})();
