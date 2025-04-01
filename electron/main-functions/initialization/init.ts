
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { app } from "electron";
import fsExtra from "fs-extra";

import Database from "libsql";

import { DBConfig } from "../../types/dbConfig";



export const defaultDBConfig: DBConfig = {
  dbName: "tagasaurus.db",
  tables: {
    metadata: "metadata",
    mediaFiles: "media_files",
    faceEmbeddings: "face_embeddings"
  },
  columns: {
    metadata: {
      id: "id",
      version: "version",
      hashType: "hash_type",
      textEmbeddingAlgorithm: "text_embedding_algorithm",
      textEmbeddingSize: "text_embedding_size",
      faceRecognitionAlgorithm: "face_recognition_algorithm",
      faceEmbeddingSize: "face_embedding_size"
    },
    mediaFiles: {
      id: "id",
      fileHash: "file_hash",
      filename: "filename",
      fileType: "file_type",
      description: "description",
      descriptionEmbedding: "description_embedding"
    },
    faceEmbeddings: {
      id: "id",
      mediaFileId: "media_file_id",
      faceEmbedding: "face_embedding"
    }
  },
  indexes: {
    mediaFilesHash: "media_files_file_hash_idx",
    mediaFilesDescriptionEmbedding: "media_files_description_embedding_idx",
    faceEmbeddingsVector: "face_embeddings_face_embedding_idx",
    faceEmbeddingsMediaFileId: "face_embeddings_media_file_id_idx"
  },
  metadata: {
    version: "1",
    hashAlgorithm: "sha256",
    textEmbeddingAlgorithm: "sentence-transformers/all-MiniLM-L6-v2",
    textEmbeddingSize: 384,
    faceEmbeddingAlgorithm: "FaceNet",
    faceEmbeddingSize: 128
  }
};




export function initTagaFolders() {
    const { tagaDir, mediaDir, tempDir, dataDir, created } = checkTagasaurusDirectories();
    console.log("TagasaurusFiles Directory:", tagaDir);
    
    if(created) {
      copyInitMediaToTemp(tempDir).catch((error) => {
          console.error("Error copying init media to TempFiles:", error);
      });
    }

    if (created) {
      try {
        setupDB(dataDir, defaultDBConfig);
      } catch (error) {
        console.error("Error creating DB:", error);
      }
    }
    

}



/**
 * Recursively creates a directory tree using single hex digits.
 * @param root - The root directory under which to create subdirectories.
 * @param levels - How many levels deep to create (each level creates 16 subdirectories).
 */
function createHexSubdirectories(root: string, levels: number): void {
  const hexDigits = "0123456789abcdef".split("");
  if (levels === 0) return;
  
  for (const digit of hexDigits) {
    const subDir = join(root, digit);
    if (!existsSync(subDir)) {
      mkdirSync(subDir);
      // console.log(`Created subdirectory: ${subDir}`);
    }
    // Recursively create the next level of subdirectories.
    createHexSubdirectories(subDir, levels - 1);
  }
}

/**
 * Ensures a sibling directory `TagasaurusFiles` is created beside your main
 * `Tagasaurus` folder, then creates two subdirectories: `MediaFiles` and `Data`.
 *
 * In packaged mode:
 * - Uses `app.getPath("exe")` to locate the executable,
 *   goes one level up, and places `TagasaurusFiles` there.
 *
 * In dev mode:
 * - Moves up from `__dirname` enough times to reach the parent folder of 
 *   `Tagasaurus/`, and creates the `TagasaurusFiles` folder there.
 *
 * @returns {TagasaurusPaths} An object with the absolute paths to:
 *  - `tagaDir`:     The main TagasaurusFiles directory
 *  - `mediaDir`:    The MediaFiles subfolder
 *  - `dataDir`:     The Data subfolder
 *  - `tempDir`:     The Temporary data folder
 *  - `created`:     Boolean for if the directory needed to be created or not
 */
export function checkTagasaurusDirectories(): {
    tagaDir: string;
    mediaDir: string;
    tempDir: string;
    dataDir: string;
    created: boolean;
  } {
    let baseDir: string;
    let created = false;
  
    if (app.isPackaged) {      
      const exeDir = dirname(app.getPath("exe"));
      baseDir = dirname(exeDir);
    } else {  
      const upOnce = dirname(__dirname);
      const upTwice = dirname(upOnce);
      const upThrice = dirname(upTwice); 
      const upFour   = dirname(upThrice);
      const upFive   = dirname(upFour);
      baseDir = upFive;
    }
  
    const tagaDir = join(baseDir, "TagasaurusFiles");
  
    if (!existsSync(tagaDir)) {
      mkdirSync(tagaDir);
      created = true;
      console.log(`Created: ${tagaDir}`);
    } else {
      console.log(`Already exists: ${tagaDir}`);
    }
  
    const mediaDir = join(tagaDir, "MediaFiles");
    if (!existsSync(mediaDir)) {
      mkdirSync(mediaDir);
      console.log(`Created: ${mediaDir}`);
    }

    // Create a 4-level deep hex subdirectory tree under MediaFiles.
    const hexLevels = 4;
    createHexSubdirectories(mediaDir, hexLevels);

    const tempDir = join(tagaDir, "TempFiles");
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir);
      console.log(`Created: ${tempDir}`);
    }
  
    const dataDir = join(tagaDir, "Data");
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir);
      console.log(`Created: ${dataDir}`);
    }
  
    return { tagaDir, mediaDir, tempDir, dataDir, created };
  }


/**
 * Copies all files from `assets/init-media` into the specified `dest` folder.
 * In dev mode, it references a relative path from __dirname.
 * In production mode, it references a folder under process.resourcesPath (or app.getAppPath()).
 *
 * @param dest - The absolute path where files will be copied (e.g. `TempFiles`).
 */
async function copyInitMediaToTemp(dest: string): Promise<void> {
    let initMediaPath: string;

    if (app.isPackaged) {
        initMediaPath = join(process.resourcesPath, "assets", "init-media");
        // alternative: initMediaPath = join(app.getAppPath(), "assets", "init-media");
    } else {
        initMediaPath = join(__dirname, "..", "..", "..", "..", "assets", "init-media");
    }

    try {
        await fsExtra.copy(initMediaPath, dest);
        console.log(`Copied init-media folder from "${initMediaPath}" to "${dest}"`);
    } catch (error) {
        console.error("Failed to copy init-media:", error);
    }
}


// DB INIT
function setupDB(dbDir: string, config: DBConfig = defaultDBConfig): void {
  const dbPath = join(dbDir, config.dbName);
  const db = new Database(dbPath);

  const { tables, columns, indexes, metadata: meta } = config;

  try {
    db.exec(`BEGIN TRANSACTION;`);

    db.exec(`
      CREATE TABLE IF NOT EXISTS ${tables.metadata} (
        ${columns.metadata.id} INTEGER PRIMARY KEY CHECK (${columns.metadata.id} = 1),
        ${columns.metadata.version} TEXT NOT NULL,
        ${columns.metadata.hashType} TEXT NOT NULL,
        ${columns.metadata.textEmbeddingAlgorithm} TEXT NOT NULL,
        ${columns.metadata.textEmbeddingSize} INTEGER NOT NULL,
        ${columns.metadata.faceRecognitionAlgorithm} TEXT NOT NULL,
        ${columns.metadata.faceEmbeddingSize} INTEGER NOT NULL
      );
    `);
    
    db.exec(`
      INSERT OR IGNORE INTO ${tables.metadata} (
        ${columns.metadata.id}, ${columns.metadata.version}, ${columns.metadata.hashType},
        ${columns.metadata.textEmbeddingAlgorithm}, ${columns.metadata.textEmbeddingSize},
        ${columns.metadata.faceRecognitionAlgorithm}, ${columns.metadata.faceEmbeddingSize}
      ) VALUES (
        1,
        '${meta.version}',
        '${meta.hashAlgorithm}',
        '${meta.textEmbeddingAlgorithm}',
        ${meta.textEmbeddingSize},
        '${meta.faceEmbeddingAlgorithm}',
        ${meta.faceEmbeddingSize}
      );
    `);
    

    db.exec(`
      CREATE TABLE IF NOT EXISTS ${tables.mediaFiles} (
        ${columns.mediaFiles.id} INTEGER PRIMARY KEY AUTOINCREMENT,
        ${columns.mediaFiles.fileHash} TEXT NOT NULL UNIQUE,
        ${columns.mediaFiles.filename} TEXT NOT NULL,
        ${columns.mediaFiles.fileType} TEXT NOT NULL,
        ${columns.mediaFiles.description} TEXT,
        ${columns.mediaFiles.descriptionEmbedding} F32_BLOB(${meta.textEmbeddingSize})
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS ${tables.faceEmbeddings} (
        ${columns.faceEmbeddings.id} INTEGER PRIMARY KEY AUTOINCREMENT,
        ${columns.faceEmbeddings.mediaFileId} INTEGER NOT NULL,
        ${columns.faceEmbeddings.faceEmbedding} F32_BLOB(${meta.faceEmbeddingSize}), 
        FOREIGN KEY (${columns.faceEmbeddings.mediaFileId}) REFERENCES ${tables.mediaFiles}(${columns.mediaFiles.id}) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS ${indexes.mediaFilesHash}
      ON ${tables.mediaFiles}(${columns.mediaFiles.fileHash});
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS ${indexes.mediaFilesDescriptionEmbedding}
      ON ${tables.mediaFiles}(libsql_vector_idx(${columns.mediaFiles.descriptionEmbedding}));
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS ${indexes.faceEmbeddingsVector}
      ON ${tables.faceEmbeddings}(libsql_vector_idx(${columns.faceEmbeddings.faceEmbedding}));
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS ${indexes.faceEmbeddingsMediaFileId}
      ON ${tables.faceEmbeddings}(${columns.faceEmbeddings.mediaFileId});
    `);

    db.exec(`COMMIT;`);
  } catch (error) {
    console.error("Error setting up database:", error);
    db.exec(`ROLLBACK;`);
    throw error;
  } finally {
    db.close();
  }
}
