
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { app } from "electron";
import fsExtra from "fs-extra";

import Database from "libsql";


export function initTagaFolders() {
    const { tagaDir, mediaDir, tempDir, dataDir, created } = checkTagasaurusFiles();
    console.log("TagasaurusFiles Directory:", tagaDir);
    
    if(created) {
      copyInitMediaToTemp(tempDir).catch((error) => {
          console.error("Error copying init media to TempFiles:", error);
      });
    }

    if (created) {
      try {
        setupDB(dataDir);
      } catch (error) {
        console.error("Error creating DB:", error);
      }
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
function checkTagasaurusFiles(): {
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
function setupDB(dbDest: string): void {
  const hashAlg = "SHA-256";
  const textEmbeddingAlg = "sentence-transformers/all-MiniLM-L6-v2";
  const textEmbeddingSize = 384;
  const faceEmbeddingAlg = "FaceNet";
  const faceEmbeddingSize = 128;

  const dbPath = join(dbDest, "tagasaurus.db")
  const db = new Database(dbPath);

  try {
    // Begin transaction
    db.exec(`BEGIN TRANSACTION;`);

    // Create metadata table
    db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        hash_type TEXT NOT NULL,
        text_embedding_algorithm TEXT NOT NULL,
        text_embedding_size INTEGER NOT NULL,
        face_recognition_algorithm TEXT NOT NULL,
        face_embedding_size INTEGER NOT NULL
      );
    `);

    // Insert metadata (idempotent insert)
    db.exec(`
      INSERT OR IGNORE INTO metadata (id, hash_type, text_embedding_algorithm, text_embedding_size, face_recognition_algorithm, face_embedding_size)
      VALUES (
        1,
        '${hashAlg}',
        '${textEmbeddingAlg}',
        ${textEmbeddingSize},
        '${faceEmbeddingAlg}',
        ${faceEmbeddingSize}
      );
    `);

    // Create media_files table
    db.exec(`
      CREATE TABLE IF NOT EXISTS media_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_hash TEXT NOT NULL UNIQUE,
        filename TEXT NOT NULL,
        file_type TEXT NOT NULL,
        description TEXT,
        description_embedding F32_BLOB(${textEmbeddingSize})
      );
    `);

    // Create face_embeddings table
    db.exec(`
      CREATE TABLE IF NOT EXISTS face_embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        media_file_id INTEGER NOT NULL,
        face_embedding F32_BLOB(${faceEmbeddingSize}),
        FOREIGN KEY (media_file_id) REFERENCES media_files(id) ON DELETE CASCADE
      );
    `);

    // Indexes
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS media_files_file_hash_idx ON media_files(file_hash);`);

    db.exec(`
      CREATE INDEX IF NOT EXISTS media_files_description_embedding_idx
      ON media_files(libsql_vector_idx(description_embedding));
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS face_embeddings_face_embedding_idx
      ON face_embeddings(libsql_vector_idx(face_embedding));
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS face_embeddings_media_file_id_idx
      ON face_embeddings(media_file_id);
    `);

    //commit transaction
    db.exec(`COMMIT;`);
  } catch (error) {
    console.error("Error setting up database:", error);
    // Rollback transaction on error to prevent partial updates!
    db.exec(`ROLLBACK;`);
  } finally {
    //database connection is closed exactly once
    db.close();
  }
}
