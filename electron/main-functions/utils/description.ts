//npm install @huggingface/transformers onnxruntime-node    # CPU build
//TODO: "asarUnpack": ["models/sentence-transformers/**"]

 //call via 
 //import { embedText } from "./main-functions/utils/description";
//   const vec = await embedText('a red cat')
//   console.log(`embedding of red cat = `, vec.length, vec[0].length); // 1 384
//   console.log(vec);


import path from 'node:path';
import * as ort from 'onnxruntime-node';
import { readFileSync } from 'fs';
import { l2NormalizeReturn } from './face';

const MODEL_DIR = path.resolve(
  __dirname,
  '..', '..', '..', '..',   // walk up to project root
  'models',
  'sentence-transformers',
  'all-MiniLM-L6-v2'
);

let setupPromise: Promise<void> | null = null;
let session: ort.InferenceSession | null = null;
let vocab: Map<string, number> | null = null;
let specialTokenIds: { [key: string]: number } = {};

// --- Simple tokenizer using only Node.js built-ins ---
function loadVocab(): Map<string, number> {
  const vocabPath = path.join(MODEL_DIR, 'vocab.txt');
  const vocabContent = readFileSync(vocabPath, 'utf-8');
  const vocab = new Map<string, number>();
  
  vocabContent.split('\n').forEach((token, index) => {
    if (token.trim()) {
      vocab.set(token.trim(), index);
    }
  });
  
  // Set up special token IDs
  specialTokenIds = {
    '[CLS]': vocab.get('[CLS]') || 101,
    '[SEP]': vocab.get('[SEP]') || 102,
    '[PAD]': vocab.get('[PAD]') || 0,
    '[UNK]': vocab.get('[UNK]') || 100
  };
  
  return vocab;
}

function simpleTokenize(text: string, vocab: Map<string, number>): { input_ids: number[], attention_mask: number[] } {
  const tokens: string[] = ['[CLS]'];
  
  // Basic tokenization - split by spaces and handle punctuation
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' $& ')  // Add spaces around punctuation
    .split(/\s+/)
    .filter(word => word.length > 0);
  
  for (const word of words) {
    if (vocab.has(word)) {
      tokens.push(word);
    } else {
      // Try to find subwords (very basic approach)
      let found = false;
      for (let i = word.length; i > 0; i--) {
        const subword = word.substring(0, i);
        if (vocab.has(subword)) {
          tokens.push(subword);
          if (i < word.length) {
            tokens.push('[UNK]'); // Rest of word as unknown
          }
          found = true;
          break;
        }
      }
      if (!found) {
        tokens.push('[UNK]');
      }
    }
  }
  
  tokens.push('[SEP]');
  
  // Convert to IDs
  const input_ids = tokens.map(token => vocab.get(token) || specialTokenIds['[UNK]']);
  const attention_mask = new Array(input_ids.length).fill(1);
  
  return { input_ids, attention_mask };
}

//simple Tensor Float32Array helper
function meanPool(tensor: ort.Tensor, attentionMask: number[]): Float32Array {
  // tensor shape: [1, tokens, 384]
  const [_, tokens, dim] = tensor.dims;
  const data = tensor.data as Float32Array;
  const out = new Float32Array(dim);
  
  let totalWeight = 0;
  for (let tok = 0; tok < tokens; ++tok) {
    const weight = attentionMask[tok];
    totalWeight += weight;
    for (let d = 0; d < dim; ++d) {
      out[d] += data[tok * dim + d] * weight;
    }
  }
  
  //average by total attention weight
  for (let d = 0; d < dim; ++d) {
    out[d] /= totalWeight;
  }
  
  return out;
}

//
async function setup() {
  if (!setupPromise) {
    setupPromise = (async () => {
      session = await ort.InferenceSession.create(path.join(MODEL_DIR, 'onnx', 'model.onnx'));
      vocab = loadVocab();
    })();
  }
  return setupPromise;
}


export async function embedText(text: string|string[]): Promise<Float32Array[]> {
  await setup();
  
  const sentences = Array.isArray(text) ? text : [text];
  const vectors: Float32Array[] = [];

  for (const sentence of sentences) {
    //tokenize using simple tokenizer
    const encoded = simpleTokenize(sentence, vocab!);
    const inputIds = encoded.input_ids;
    const attentionMask = encoded.attention_mask;
    
    //create ONNX tensors
    const inputIdsTensor = new ort.Tensor('int64', new BigInt64Array(inputIds.map(id => BigInt(id))), [1, inputIds.length]);
    const attentionMaskTensor = new ort.Tensor('int64', new BigInt64Array(attentionMask.map(mask => BigInt(mask))), [1, attentionMask.length]);
    
    //run inference
    const feeds = {
      input_ids: inputIdsTensor,
      attention_mask: attentionMaskTensor
    };
    
    const results = await session!.run(feeds);
    const lastHiddenState = results.last_hidden_state || results[Object.keys(results)[0]];
    
    const pooled = meanPool(lastHiddenState, attentionMask);

    vectors.push(l2NormalizeReturn(pooled));
  }

  return vectors;
}







