

export interface MediaFile {
    id?: number;                 // primary key
    fileHash: string;            // hash of the file
    filename: string;
    fileType: string;
    description: string;
    descriptionEmbedding: Float32Array | number[] | null; //descriptionEmbedding: Float32Array | null;
}

export interface FaceEmbedding {
  id?: number;
  mediaFileId: number;
  time?: number | null;       //seconds from the start of the video (NULL for still images/GIF frames)
  faceEmbedding: number[];    //faceEmbedding: Float32Array;
  score?: number;              // SCRFD confidence
  bbox:  number[];            // [x1, y1, x2, y2]  (len 4)
  landmarks: number[];        // [x0, y0, ..., x4, y4] (len 10)
}

export interface FaceEmbeddingSample extends FaceEmbedding {
  fileHash: string; //hash of the underlying media file
  fileType: string; //image/video/image gif etc
}
  
export type DeviceGPU = 'gpu' | 'wasm';


export type SearchRow = {
  fileHash: string;
  fileType: string;
  description: string | null; // description may be NULL
};


export type FaceHit = {
  media  : MediaFile;
  face   : FaceEmbedding;
  dist   : number;         // cosine distance (lower = closer)
};


 