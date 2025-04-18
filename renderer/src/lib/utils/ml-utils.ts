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