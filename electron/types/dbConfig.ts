export interface DBConfig {
  dbName: string;
  tables: {
    metadata: string;
    mediaFiles: string;
    faceEmbeddings: string;
  };
  columns: {
    metadata: {
      id: string;
      version: string;
      hashType: string;
      textEmbeddingAlgorithm: string;
      textEmbeddingSize: string;
      faceRecognitionAlgorithm: string;
      faceEmbeddingSize: string;
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
    faceEmbeddingAlgorithm: string;
    faceEmbeddingSize: number;
  };
}
