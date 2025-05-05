
import { promises as fsPromises } from "fs";
import { join, dirname } from "path";
import { app } from "electron";
import fsExtra from "fs-extra";

import Database from "libsql/promise";

import { DBConfig, DBConfigFileQueue } from "../../types/dbConfig";


export const defaultDBConfig: DBConfig = {
  dbName: "tagasaurus.db",
  tables: {
    metadata: "metadata",
    dbStats: "db_stats",
    mediaFiles: "media_files",
    faceEmbeddings: "face_embeddings"
  },
  columns: {
    metadata: {
      id: "id",
      version: "version",
      hashAlgorithm: "hash_algorithm",
      textEmbeddingAlgorithm: "text_embedding_algorithm",
      textEmbeddingSize: "text_embedding_size",
      textEmbeddingPrecision: "text_embedding_precision",
      faceEmbeddingAlgorithm: "face_embedding_algorithm",
      faceEmbeddingSize: "face_embedding_size",
      faceEmbeddingPrecision: "face_embedding_precision"
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
    },
    dbStats: {
      tableName: "table_name",
      rowCount: "row_count"
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
    textEmbeddingPrecision: "f32",
    faceEmbeddingAlgorithm: "ArcFace-R50_w600k_r50.onnx",
    faceEmbeddingSize: 512,
    faceEmbeddingPrecision: "f32"
  }
};



export const defaultDBConfigFileQueue: DBConfigFileQueue = {
  dbName: "fileQueue.db",
  tables: {
    newPaths: "newPaths",
    newFilePaths: "newFilePaths"
  },
  columns: {
    newPaths: {
      id: "id",
      path: "path"
    },
    newFilePaths: {
      id: "id",
      path: "path"
    }
  }
}


export async function initTagaFoldersAndDBSetups(db: Database, db_fileQueue: Database, created: boolean) {
    
    const { tagaDir, mediaDir, tempDir, dataDir } = await checkTagasaurusDirectories();
    
    if(created) {
      await copyInitMediaToTemp(tempDir).catch((error) => {
          console.error("Error copying init media to TempFiles:", error);
      });
    }

    if (created) {
      try {
        await setupDB(db, defaultDBConfig);
      } catch (error) {
        console.error("Error creating DB:", error);
      }
    }
    
    if (created) {
      try {
        await setupFileQueueDB(db_fileQueue, defaultDBConfigFileQueue);
      } catch (error) {
        console.error("Error creating file queue DB:", error);
      }
    }
}



/**
 * Recursively creates a directory tree using single hex digits.
 * @param root - The root directory under which to create subdirectories.
 * @param levels - How many levels deep to create (each level creates 16 subdirectories).
 */
async function createHexSubdirectories(root: string, levels: number): Promise<void> {
  const hexDigits = "0123456789abcdef".split("");
  if (levels === 0) return;
  
  //use Promise.all to create subdirectories in parallel for better performance
  const promises = hexDigits.map(async (digit) => {
    const subDir = join(root, digit);
    try {
      //check if directory exists
      try {
        await fsPromises.access(subDir);
      } catch {
        //directory doesn't exist, create it
        await fsPromises.mkdir(subDir);
      }
      
      //recursively create the next level of subdirectories
      await createHexSubdirectories(subDir, levels - 1);
    } catch (error) {
      console.error(`Error creating subdirectory ${subDir}:`, error);
    }
  });
  
  await Promise.all(promises);
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
export async function checkTagasaurusDirectories(): Promise<{
    tagaDir: string;
    mediaDir: string;
    tempDir: string;
    dataDir: string;
    created: boolean;
  }> {
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

    try {
      //check if directory exists
      try {
        await fsPromises.access(tagaDir); //TODO: fsPromises.mkdir(path, { recursive:true }) instead
        console.log(`Already exists: ${tagaDir}`);
      } catch {
        //directory doesn't exist, create it
        await fsPromises.mkdir(tagaDir);
        created = true;
        console.log(`Created: ${tagaDir}`);
      }

      const mediaDir = join(tagaDir, "MediaFiles");
      try {
        await fsPromises.access(mediaDir);
      } catch {
        await fsPromises.mkdir(mediaDir);
        console.log(`Created: ${mediaDir}`);
      }

      //create a 4-level deep hex subdirectory tree under MediaFiles
      const hexLevels = 4;
      await createHexSubdirectories(mediaDir, hexLevels);

      const tempDir = join(tagaDir, "TempFiles");
      try {
        await fsPromises.access(tempDir);
      } catch {
        await fsPromises.mkdir(tempDir);
        console.log(`Created: ${tempDir}`);
      }

      const dataDir = join(tagaDir, "Data");
      try {
        await fsPromises.access(dataDir);
      } catch {
        await fsPromises.mkdir(dataDir);
        console.log(`Created: ${dataDir}`);
      }

      return { tagaDir, mediaDir, tempDir, dataDir, created };
    } catch (error) {
      console.error("Error checking/creating directories:", error);
      throw error;
    }
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
async function setupDB(db: Database, config: DBConfig = defaultDBConfig): Promise<void> {
  await db.exec(`PRAGMA journal_mode = WAL;`);
  await db.exec('PRAGMA foreign_keys = ON');

  const { tables, columns, indexes, metadata: meta } = config;

    // column type depends on precision field
    const descVecDDL = meta.textEmbeddingPrecision === "f32"
      ? `F32_BLOB(${meta.textEmbeddingSize})`
      : `F16_BLOB(${meta.textEmbeddingSize})`;

    const faceVecDDL = meta.faceEmbeddingPrecision === "f32"
      ? `F32_BLOB(${meta.faceEmbeddingSize})`
      : `F16_BLOB(${meta.faceEmbeddingSize})`;

  try {
    await db.exec(`BEGIN TRANSACTION;`);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS ${tables.metadata} (
        ${columns.metadata.id} INTEGER PRIMARY KEY CHECK (${columns.metadata.id} = 1),
        ${columns.metadata.version} TEXT NOT NULL,
        ${columns.metadata.hashAlgorithm} TEXT NOT NULL,
        ${columns.metadata.textEmbeddingAlgorithm} TEXT NOT NULL,
        ${columns.metadata.textEmbeddingSize} INTEGER NOT NULL,
        ${columns.metadata.textEmbeddingPrecision} TEXT NOT NULL,
        ${columns.metadata.faceEmbeddingAlgorithm} TEXT NOT NULL,
        ${columns.metadata.faceEmbeddingSize} INTEGER NOT NULL,
        ${columns.metadata.faceEmbeddingPrecision} TEXT NOT NULL
      );
    `);
    
    await db.exec(`
      INSERT OR IGNORE INTO ${tables.metadata} (
        ${columns.metadata.id}, ${columns.metadata.version}, ${columns.metadata.hashAlgorithm},
        
        ${columns.metadata.textEmbeddingAlgorithm}, ${columns.metadata.textEmbeddingSize},
        ${columns.metadata.textEmbeddingPrecision},

        ${columns.metadata.faceEmbeddingAlgorithm}, ${columns.metadata.faceEmbeddingSize},
        ${columns.metadata.faceEmbeddingPrecision}
      ) VALUES (
        1,
        '${meta.version}',
        '${meta.hashAlgorithm}',
        '${meta.textEmbeddingAlgorithm}',
        ${meta.textEmbeddingSize},
        '${meta.textEmbeddingPrecision}',
        '${meta.faceEmbeddingAlgorithm}',
        ${meta.faceEmbeddingSize},
        '${meta.faceEmbeddingPrecision}'
      );
    `);
    
    await db.exec(`
      CREATE TABLE IF NOT EXISTS ${tables.mediaFiles} (
        ${columns.mediaFiles.id} INTEGER PRIMARY KEY AUTOINCREMENT,
        ${columns.mediaFiles.fileHash} TEXT NOT NULL UNIQUE,
        ${columns.mediaFiles.filename} TEXT NOT NULL,
        ${columns.mediaFiles.fileType} TEXT NOT NULL,
        ${columns.mediaFiles.description} TEXT,
        ${columns.mediaFiles.descriptionEmbedding} ${descVecDDL}
      );
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS ${tables.faceEmbeddings} (
        ${columns.faceEmbeddings.id} INTEGER PRIMARY KEY AUTOINCREMENT,
        ${columns.faceEmbeddings.mediaFileId} INTEGER NOT NULL,
        ${columns.faceEmbeddings.faceEmbedding} ${faceVecDDL}, 
        FOREIGN KEY (${columns.faceEmbeddings.mediaFileId}) REFERENCES ${tables.mediaFiles}(${columns.mediaFiles.id}) ON DELETE CASCADE
      );
    `);

    await db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS ${indexes.mediaFilesHash}
      ON ${tables.mediaFiles}(${columns.mediaFiles.fileHash});
    `);

    await db.exec(`
      CREATE INDEX IF NOT EXISTS ${indexes.mediaFilesDescriptionEmbedding}
      ON ${tables.mediaFiles}(libsql_vector_idx(${columns.mediaFiles.descriptionEmbedding}));
    `);

    await db.exec(`
      CREATE INDEX IF NOT EXISTS ${indexes.faceEmbeddingsVector}
      ON ${tables.faceEmbeddings}(libsql_vector_idx(${columns.faceEmbeddings.faceEmbedding}));
    `);

    await db.exec(`
      CREATE INDEX IF NOT EXISTS ${indexes.faceEmbeddingsMediaFileId}
      ON ${tables.faceEmbeddings}(${columns.faceEmbeddings.mediaFileId});
    `);

    //---------------------
    //DB stats
    await db.exec(`
      CREATE TABLE IF NOT EXISTS ${tables.dbStats} (
        ${columns.dbStats.tableName} TEXT PRIMARY KEY,
        ${columns.dbStats.rowCount} INTEGER NOT NULL DEFAULT 0
      );
    `);

    // Insert row for "media_files" if not existing
    await db.exec(`
      INSERT OR IGNORE INTO ${tables.dbStats} (
        ${columns.dbStats.tableName}, 
        ${columns.dbStats.rowCount}
      )
      VALUES ('${tables.mediaFiles}', 0);
    `);

    await db.exec(`
      CREATE TRIGGER IF NOT EXISTS increment_media_files_count
      AFTER INSERT ON ${tables.mediaFiles}
      BEGIN
        UPDATE ${tables.dbStats}
        SET ${columns.dbStats.rowCount} = ${columns.dbStats.rowCount} + 1
        WHERE ${columns.dbStats.tableName} = '${tables.mediaFiles}';
      END;
    `);

    await db.exec(`
      CREATE TRIGGER IF NOT EXISTS decrement_media_files_count
      AFTER DELETE ON ${tables.mediaFiles}
      BEGIN
        UPDATE ${tables.dbStats}
        SET ${columns.dbStats.rowCount} = ${columns.dbStats.rowCount} - 1
        WHERE ${columns.dbStats.tableName} = '${tables.mediaFiles}';
      END;
    `);


    await fixMediaFilesRowCountIfZero(db, config);

    await db.exec(`COMMIT;`);
  } catch (error) {
    console.error("Error setting up database:", error);
    await db.exec(`ROLLBACK;`);
  }

}


async function setupFileQueueDB(
  db_fileQueue: Database,
  cfg: DBConfigFileQueue = defaultDBConfigFileQueue,
): Promise<void> {
  const { tables, columns } = cfg;
  try {
    await db_fileQueue.exec('BEGIN TRANSACTION;');
    await db_fileQueue.exec(`
      CREATE TABLE IF NOT EXISTS ${tables.newPaths} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ${columns.newPaths.path} TEXT UNIQUE
      );
    `);
    await db_fileQueue.exec(`
      CREATE TABLE IF NOT EXISTS ${tables.newFilePaths} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ${columns.newFilePaths.path} TEXT UNIQUE
      );
    `);
    await db_fileQueue.exec('COMMIT;');
  } catch (err) {
    console.error('Error setting up file queue DB:', err);
    await db_fileQueue.exec('ROLLBACK;');
  }

}




export async function fixMediaFilesRowCountIfZero(
  db: Database,
  config: DBConfig
): Promise<void> {
  const { tables, columns } = config;

  const stmt = await db.prepare(`
    SELECT ${columns.dbStats.rowCount} AS rc
    FROM ${tables.dbStats}
    WHERE ${columns.dbStats.tableName} = '${tables.mediaFiles}'
  `);
  const rowCountObj = await stmt.get();

  const currentCount = rowCountObj ? rowCountObj.rc : 0;

  if (currentCount === 0) {
    const stmt2 = await db.prepare(`
      SELECT COUNT(*) AS existingCount
      FROM ${tables.mediaFiles};
    `);
    const countRow = await stmt2.get();

    const existingCount = countRow?.existingCount ?? 0;

    if (existingCount > 0) {
      const stmt3 = await db.prepare(`
        UPDATE ${tables.dbStats}
        SET ${columns.dbStats.rowCount} = ?
        WHERE ${columns.dbStats.tableName} = '${tables.mediaFiles}'
      `);
      
      await stmt3.run(existingCount);
      
    }
  }
}