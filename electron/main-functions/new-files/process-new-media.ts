import * as path from "path";
import * as fs from "fs";

import { BrowserWindow } from "electron";

import { DBConfig } from "../../types/dbConfig";
import { type Database } from "libsql";
import { defaultDBConfig } from "../initialization/init";

import {computeFileHash, detectTypeFromPartialBuffer, getHashSubdirectory } from "../utils/utils"


/**
 * processes all files in `tempDir`:
 * 1. compute SHA-256 hash
 * 2. if hash already in DB, remove from tempDir
 * 3. else, begin DB transaction:
 *    - insert row in `media_files`
 *    - move file to a 4-level subdirectory named by first 4 chars of its hash
 *    - if move fails, roll back
 *    - else commit
 *
 * @param db         An open libsql Database instance
 * @param tempDir    Path to the temporary dir
 * @param mediaDir   Path to the root media dir (inside which the 4-level subdirs exist)
 * @param mainWindow The main window for the user
 */
export async function processTempFiles(
  db: Database,
  tempDir: string,
  mediaDir: string,
  mainWindow: BrowserWindow
): Promise<void> {
  const files = fs.readdirSync(tempDir); //list files needing processing
  console.log("FOO")
  //get the table/column references
  const { tables, columns, metadata } = defaultDBConfig;
  const { mediaFiles } = tables;
  const { fileHash, filename, fileType, description, descriptionEmbedding } =
    columns.mediaFiles;

  //prepare a statement to see if the file's hash already exists
  const checkHashStmt = db.prepare(`
    SELECT 1 FROM ${mediaFiles}
    WHERE ${fileHash} = ?
  `);

  //prep the insert statement
  const insertStmt = db.prepare(`
    INSERT INTO ${mediaFiles} (
      ${fileHash},
      ${filename},
      ${fileType},
      ${description},
      ${descriptionEmbedding}
    ) VALUES (?, ?, ?, ?, ?)
  `);

  for (const tempFile of files) {
    console.log("BAR")
    const tempFilePath = path.join(tempDir, tempFile);
    console.log(`tempFilePath = ${tempFilePath}`)
    try {
      const hash = computeFileHash(tempFilePath, defaultDBConfig.metadata.hashAlgorithm);

      const existing = checkHashStmt.get(hash);
      if (existing) {
        //exists, exact file, remove from tempDir
        fs.unlinkSync(tempFilePath);
        // console.log(`duplicate detected (hash = ${hash}). Removed ${tempFile}.`);
        continue;
      }

      //not a duplicate => get fileType from extension      
      const result = await detectTypeFromPartialBuffer(tempFilePath); //(tempFile);
      const inferredFileType = result.mime;

      db.exec("BEGIN TRANSACTION;");

      //insert row with empty description and null embedding (or "")
      //'filename' store the user’s original name
      insertStmt.run(
        hash,            //fileHash
        tempFile,        //filename (the original user name, or store something else)
        inferredFileType, //fileType
        "",              //description
        null             //descriptionEmbedding
      );

      //move file to the correct subdirectory
      const subPath = getHashSubdirectory(hash); // e.g. "a/3/e/7"
      const finalDir = path.join(mediaDir, subPath);
      
      // e.g. "a3e71df2abc", dp mopt store file extensions just the hash and use the inferred filetype later
      const finalName = hash;
      const finalPath = path.join(finalDir, finalName);

      // Attempt to move
      fs.renameSync(tempFilePath, finalPath);

      //if succeeded commit
      db.exec("COMMIT;");

      console.log(`Successfully imported "${tempFile}" as hash=${hash}.`);

      mainWindow.webContents.send("new-media", hash);
      console.log("BAZ")
    } catch (err) {
      console.error(`Error processing file: ${tempFile}`, err);

      //roll back DB changes if anything failed (db insert or rename)
      try {
        db.exec("ROLLBACK;");
      } catch (rollbackErr) {
        console.error("Rollback error:", rollbackErr);
      }

    }
  }
}
