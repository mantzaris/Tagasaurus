export function meanPool(tensor:any) {
    // The pipeline returned a 3D tensor [batch_size, seq_len, hidden_dim].
    // For one sentence at a time, batch_size = 1.
    const [batchSize, seqLen, dim] = tensor.dims; // e.g. [1, 17, 384]
    const data = tensor.data; // A Float32Array of length seqLen * dim
  
    // We'll create an output vector of length "dim" initialized to 0
    const out = new Float32Array(dim).fill(0);
  
    // Sum across all tokens
    for (let i = 0; i < seqLen; i++) {
      for (let j = 0; j < dim; j++) {
        out[j] += data[i * dim + j];
      }
    }
    // Divide by seqLen to get the average
    for (let j = 0; j < dim; j++) {
      out[j] /= seqLen;
    }
    return out;
}


// Helper: Calculate centroid distance between two boxes
export function boxDistance(boxA: number[], boxB: number[]): number {
    const cxA = (boxA[0] + boxA[2]) / 2;
    const cyA = (boxA[1] + boxA[3]) / 2;
    const cxB = (boxB[0] + boxB[2]) / 2;
    const cyB = (boxB[1] + boxB[3]) / 2;
    return Math.sqrt(Math.pow(cxA - cxB, 2) + Math.pow(cyA - cyB, 2));
}


export const distanceCosine0to2 = (a: number[], b: number[], eps = 1e-9): number => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const va = a[i], vb = b[i];
    dot += va * vb;      // a · b
    na  += va * va;      // ||a||²
    nb  += vb * vb;      // ||b||²
  }
  return 1 - dot / (Math.sqrt(na * nb) + eps);   // 1 - cosθ in [0, 2]
};