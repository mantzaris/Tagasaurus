import fs from "fs/promises";
import path from "path";
import Database from "libsql/promise";

import { getHashSubdirectory } from "../utils/utils";
import { DBConfig } from "../../types/dbConfig";

/**
 * deleteMediaFileByHash
 * 
 * @param db       - An *open* Database instance (won't be closed here)
 * @param mediaDir - The base directory that stores your files, named by hash
 * @param fileHash - The hash of the file to remove (disk + DB)
 * @param config   - DB config for table/column names
 * 
 * Behavior:
 *  tries to delete the file on disk: `mediaDir/<subDir>/<hash>`
 *     - if missing, logs a warning but continues
 *  tries to delete the matching DB row in media_files if found
 *     - if missing, logs a warning but continues
 *  rolls back only on DB-level errors and logs them (doesn't re-throw)
 *  uses ON DELETE CASCADE for related face embeddings (if configured)
 */
export async function deleteMediaFileByHash(
  db: Database,
  mediaDir: string,
  fileHash: string,
  config: DBConfig
): Promise<void> {
  //ensure we have foreign key constraints enabled (needed for ON DELETE CASCADE)
  await db.exec("PRAGMA foreign_keys = ON;");
  await db.exec("BEGIN TRANSACTION;");

  try {
    const subDir = getHashSubdirectory(fileHash); // e.g. "a/b/c/d"
    const absoluteFilePath = path.join(mediaDir, subDir, fileHash);

    try {
      await fs.unlink(absoluteFilePath);
      console.log(`Deleted file on disk: ${absoluteFilePath}`);
    } catch (fsErr) {
      console.warn(
        `File not found or could not be removed (hash=${fileHash}): ${absoluteFilePath}`
      );
    }

    //try delete from DB (when row exists)
    const { mediaFiles } = config.tables;
    const { fileHash: fileHashCol, id } = config.columns.mediaFiles;

    //check if there is matching DB row
    const selectStmt = await db.prepare(
        `SELECT ${id} 
         FROM ${mediaFiles}
         WHERE ${fileHashCol} = ?`
    );
    const row = await selectStmt.get(fileHash);

    if (!row) {
      console.warn(`No DB entry found for fileHash=${fileHash}. Skipping DB delete.`);
    } else {
      //there is row now proceed to delete
      const deleteStmt = await db.prepare(
        `DELETE FROM ${mediaFiles}
         WHERE ${fileHashCol} = ?`
      );
      await deleteStmt.run(fileHash);

      console.log(`Deleted DB entry + cascaded embeddings for fileHash=${fileHash}`);
    }

    await db.exec("COMMIT;");
  } catch (err) {
    await db.exec("ROLLBACK;");
    console.error("Error during deletion transaction:", err);
  }
}
