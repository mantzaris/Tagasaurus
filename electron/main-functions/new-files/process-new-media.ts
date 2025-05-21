import * as path from "path";
import * as fs from "fs";

import { BrowserWindow } from "electron";

import { type Database } from "libsql/promise";
import { defaultDBConfig } from "../initialization/init";

import { computeFileHash, detectTypeFromPartialBuffer, getHashSubdirectory } from "../utils/utils"
import { convertMediaFile,  isAllowedFileType } from "../utils/media-conversion"; //detectAnimation
import { MediaFile } from "../../types/dbConfig";

import { faceSetupOnce, processFacesFromMedia } from "../utils/face-utils";


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

  
  console.log("beginning process-new-media.ts");

  const dir = await fs.promises.opendir(tempDir);

  try {
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
        if (!result || !result.mime) {
          console.warn('Could not detect type, deleting', tempFilePath);
          await fs.promises.unlink(tempFilePath).catch(() => {});
          continue;
        }
        
        let inferredFileType = result.mime;      
        console.log(`inferredFileType = ${inferredFileType} \n hash = ${hash}`);
        
        if (!isAllowedFileType(inferredFileType)) {
          console.log('not allowed file type');
  
          const conversion = await convertMediaFile(inferredFileType, tempFilePath, tempDir, tempFile);
          console.log(`conversion = ${JSON.stringify(conversion)}`);
  
          if (!conversion) {
            console.log('could not convert, deleting file');
            await fs.promises.unlink(tempFilePath).catch(() => {});
            continue;
          }
  
          console.log('converted file');
          await fs.promises.unlink(tempFilePath).catch(() => {});
  
          try {
            hash = await computeFileHash(conversion.newFilePath, defaultDBConfig.metadata.hashAlgorithm);
          } catch (e) {
            console.error('hash failed, deleting converted file', e);
            await fs.promises.unlink(conversion.newFilePath).catch(() => {});
            continue;
          }

          if (await checkHashStmt.get(hash)) { //make sure the new converted file is unique
            console.log('duplicate after conversion; deleting', conversion.newFilePath);
            await fs.promises.unlink(conversion.newFilePath).catch(() => {});
            continue;
          }
        
          tempFile         = conversion.newFileName;
          inferredFileType = conversion.newMime;
          tempFilePath     = path.join(tempDir, tempFile);
        }


        //FACE EMBEDDINGS---------
        if (inferredFileType.startsWith('image/') || inferredFileType.startsWith('video/')) { //TODO: webp issues
          
          // console.log(`new embeddings:`);
          // const embsNew = await processFacesOnImage(tempFilePath, inferredFileType);
          // embsNew.forEach((emb, idx) => {
          //          console.log(`file ${hash}  face #${idx}  emb[0..10] =`,
          //                      Array.from(emb.slice(0, 11)));
          // });


          const embsNew = await processFacesFromMedia(tempFilePath, inferredFileType);
          console.log(`NEW EMBS`);
          embsNew.forEach((emb, idx) => {
                   console.log(`file ${hash}  face #${idx}  emb[0..10] =`,
                               Array.from(emb.slice(0, 11)));
          });

        }
        //--------------------
        
        //TODO: INSERT INTO face_embeddings (file_id, face_idx, vector)
        //TODO: fail here should be handled not just transaction failure
  
        
        await db.exec("BEGIN TRANSACTION;");

        try {
           //insert row with empty description and null embedding (or "")
          //'filename' store the user's original name
          await insertStmt.run(
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
          const finalPath = path.join(finalDir, hash);

          await fs.promises.mkdir(finalDir, { recursive: true });
          
          await moveOrCopy(tempFilePath, finalPath);   // handles EXDEV

          await db.exec("COMMIT;");
        } catch (txErr) {
          console.error('Tx error', txErr);
          await db.exec('ROLLBACK;').catch(e=>console.error('Rollback failed', e));
          continue;
        }
  
        const insertedFile = await fetchStmt.get<MediaFile>(hash);//TODO: needed to notify UI?
  
        if (insertedFile) {
          mainWindow.webContents.send("new-media", insertedFile);//TODO: needed to notify UI?
        }
  
      } catch (err) {
        console.error(`Error processing file: ${tempFile}`, err);
  
        //roll back DB changes if anything failed (db insert or rename)
        try {
          await db.exec("ROLLBACK;");
        } catch (rollbackErr) {
          console.error("Rollback error:", rollbackErr);
        }
  
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }
    }

  } finally {
    await dir.close().catch(()=>{}); 
  }

}


async function moveOrCopy(src: string, dst: string) {
  try {
    await fs.promises.rename(src, dst);
  } catch (err: any) {
    if (err.code === 'EXDEV') {
      try {
        await fs.promises.copyFile(src, dst);
        await fs.promises.unlink(src);
      } catch (copyErr) {
        // clean partial dst; rethrow so outer catch rolls back
        await fs.promises.unlink(dst).catch(()=>{});
        throw copyErr;
      }
    } else {
      throw err;
    }
  }
}
