import * as path from "path";
import * as fs from "fs";

import { BrowserWindow } from "electron";

import { type Database } from "libsql/promise";
import { defaultDBConfig } from "../initialization/init";

import { computeFileHash, detectTypeFromPartialBuffer, getHashSubdirectory } from "../utils/utils"
import { convertMediaFile,  isAllowedFileType } from "../utils/media-conversion"; //detectAnimation
import { MediaFile } from "../../types/dbConfig";
import { analyseAnimated, faceSetupOnce, processFacesOnImage } from "../utils/face-utils";



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

  console.log('before face setup once')
  await faceSetupOnce();
  console.log('after face setup once')

  //get the table/column references
  const { tables, columns, metadata } = defaultDBConfig;
  const { mediaFiles } = tables;
  const { fileHash, filename, fileType, description, descriptionEmbedding } =
    columns.mediaFiles;

  //prepare a statement to see if the file's hash already exists
  const checkHashStmt = await db.prepare(`
    SELECT 1 FROM ${mediaFiles}
    WHERE ${fileHash} = ?
  `);

  //prep the insert statement
  const insertStmt = await db.prepare(`
    INSERT INTO ${mediaFiles} (
      ${fileHash},
      ${filename},
      ${fileType},
      ${description},
      ${descriptionEmbedding}
    ) VALUES (?, ?, ?, ?, ?)
  `);

  const fetchStmt = await db.prepare(`
    SELECT
      id,
      file_hash             AS fileHash,
      filename,
      file_type             AS fileType,
      description,
      description_embedding AS descriptionEmbedding
    FROM ${mediaFiles}
    WHERE file_hash = ?
  `);

  //const files = await fs.promises.readdir(tempDir); //list files needing processing
  //for (const file of files) {
    //let tempFile = file;
    //let tempFilePath = path.join(tempDir, tempFile);

  const dir = await fs.promises.opendir(tempDir);
  for await (const dirent of dir) {
    console.log(`dirent = ${JSON.stringify(dirent)}`)
    if (!dirent.isFile()) continue;  
    let tempFile = dirent.name;
    let tempFilePath = path.join(tempDir, tempFile);
        
    try {
      let hash = await computeFileHash(tempFilePath, defaultDBConfig.metadata.hashAlgorithm);

      const existing = await checkHashStmt.get(hash);
      if (existing) {
        //exists, exact file, remove from tempDir
        await fs.promises.unlink(tempFilePath);
        continue;
      }

      //not a duplicate => get fileType from extension      
      const result = await detectTypeFromPartialBuffer(tempFilePath); //(tempFile);
      let inferredFileType = result.mime;
      console.log('-------01')
      if (!isAllowedFileType(inferredFileType)) {
        console.log('---------02')
        const conversion = await convertMediaFile(inferredFileType, tempFilePath, tempDir, tempFile);
        console.log('---------03')
        if (!conversion) {
          await fs.promises.unlink(tempFilePath);
          continue;
        }
        
        if (conversion) {
          console.log('---------04')
          await fs.promises.unlink(tempFilePath);
          hash = await computeFileHash(conversion.newFilePath, defaultDBConfig.metadata.hashAlgorithm);
          tempFile = conversion.newFileName;
          inferredFileType = conversion.newMime;
          tempFilePath = path.join(tempDir, tempFile);
        }
      }
      console.log('---------05')
      //FACE EMBEDDINGS
      // if (inferredFileType.startsWith('image/')) {        
      //   console.log('---------06');
      //   const isAnimated = await detectAnimation(tempFilePath);
      //   console.log(`isAnimated = ${isAnimated}`);
      //   if (isAnimated) {
      //     console.log('---------07  animated image');
      //     try {
      //       await analyseAnimated(tempFilePath, inferredFileType);           // ← await it
      //     } catch (err) {
      //       console.error('analyseAnimated failed:', err);
      //     }
      //     return;                                         // stop further handling
      //   } else {
      //     console.log('---------08')
      //     const embs = await processFacesOnImage(tempFilePath);   // <- see below
      //     embs.forEach((emb, idx) => {
      //       console.log(`file ${hash}  face #${idx}  emb[0..7] =`,
      //                   Array.from(emb.slice(0, 8)));
      //     });
      //   }
        
      // }
      // TODO: INSERT INTO face_embeddings (file_id, face_idx, vector)
      //TODO: fail here should be handled not just transaction failure

      await db.exec("BEGIN TRANSACTION;");

      //move file to the correct subdirectory
      const subPath = getHashSubdirectory(hash); // e.g. "a/3/e/7"
      const finalDir = path.join(mediaDir, subPath);
      
      // e.g. "a3e71df2abc", dp mopt store file extensions just the hash and use the inferred filetype later
      const finalPath = path.join(finalDir, hash);
      await fs.promises.mkdir(finalDir, { recursive: true });
      await fs.promises.rename(tempFilePath, finalPath); //attempt to move

      //insert row with empty description and null embedding (or "")
      //'filename' store the user's original name
      await insertStmt.run(
        hash,            //fileHash
        tempFile,        //filename (the original user name, or store something else)
        inferredFileType, //fileType
        "",              //description
        null             //descriptionEmbedding
      );

      //if succeeded commit
      await db.exec("COMMIT;");

      const insertedFile = await fetchStmt.get<MediaFile>(hash);//TODO: needed?

      if (insertedFile) {
        mainWindow.webContents.send("new-media", insertedFile);//TODO: needed?
      }

    } catch (err) {
      console.error(`Error processing file: ${tempFile}`, err);

      //roll back DB changes if anything failed (db insert or rename)
      try {
        await db.exec("ROLLBACK;");
      } catch (rollbackErr) {
        console.error("Rollback error:", rollbackErr);
      }

    }
  }
}


// //If tempDir and mediaDir live on different mount points (e.g. /tmp on tmpfs, media on /home/... or on an external drive), POSIX rename() returns -1 EXDEV. On Windows an out‑of‑volume rename simply fails with ERROR_NOT_SAME_DEVICE
// async function moveOrCopy(src: string, dst: string) {
//   try {
//     await fs.rename(src, dst);
//   } catch (err: any) {
//     if (err.code === "EXDEV") {                 // cross‑device
//       await fs.copyFile(src, dst);
//       await fs.unlink(src);
//     } else {
//       throw err;   // genuine failure: propagate
//     }
//   }
// }