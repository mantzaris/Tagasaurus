export interface MediaFile {
  id?: number;                 // primary key TODO: BigInt ???
  fileHash: string;            // hash of the file
  filename: string;
  fileType: string;
  description: string;
  descriptionEmbedding: Float32Array | number[] | null; //descriptionEmbedding: Float32Array | null;
}

export interface FaceEmbedding {
  id?: number;
  mediaFileId: number;
  faceEmbedding: number[]; //faceEmbedding: Float32Array;
}

export interface DBConfig {
  dbName: string;
  tables: {
    metadata: string;
    mediaFiles: string;
    faceEmbeddings: string;
    dbStats:string;
  };
  columns: {
    metadata: {
      id: string;
      version: string;
      hashAlgorithm: string;
      textEmbeddingAlgorithm: string;
      textEmbeddingSize: string;
      textEmbeddingPrecision: string;
      faceEmbeddingAlgorithm: string;
      faceEmbeddingSize: string;
      faceEmbeddingPrecision: string;
    };
    mediaFiles: {
      id: string;
      fileHash: string;
      filename: string;
      fileType: string;
      description: string;
      descriptionEmbedding: string;
    };
    faceEmbeddings: {
      id: string;
      mediaFileId: string;
      faceEmbedding: string;
    };
    dbStats: {
      tableName: string;
      rowCount: string;
    }
  };
  indexes: {
    mediaFilesHash: string;
    mediaFilesDescriptionEmbedding: string;
    faceEmbeddingsVector: string;
    faceEmbeddingsMediaFileId: string;
  };
  metadata: {
    version: string;
    hashAlgorithm: string;
    textEmbeddingAlgorithm: string;
    textEmbeddingSize: number;
    textEmbeddingPrecision: 'f16' | 'f32';
    faceEmbeddingAlgorithm: string;
    faceEmbeddingSize: number;
    faceEmbeddingPrecision: 'f16' | 'f32';
  }
}


//---
//for the temporary queue db, fileQueue.db

export interface NewPaths {
  path: string;
}

export interface NewFilePaths {
  path: string;
}

export interface DBConfigFileQueue {
  dbName: string;
  tables: {
    newPaths: string;
    newFilePaths: string;
  };
  columns: {
    newPaths: {
      id: string,
      path: string;
    };
    newFilePaths: {
      id: string,
      path: string;
    };
  };
}