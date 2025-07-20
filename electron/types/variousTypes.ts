import { FaceEmbedding, MediaFile } from "./dbConfig";


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

