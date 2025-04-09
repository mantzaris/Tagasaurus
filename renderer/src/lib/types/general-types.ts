export interface MediaFile {
    id?: number;                 // primary key
    fileHash: string;            // hash of the file
    filename: string;
    fileType: string;
    description: string;
    descriptionEmbedding: number[] | null; //descriptionEmbedding: Float32Array | null;
  }
  