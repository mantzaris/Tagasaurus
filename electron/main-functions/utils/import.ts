
import * as tar from "tar";
import { tmpdir } from "os";
import { join }    from "path";
import { promises as fs } from "fs";
import Database    from "libsql/promise";
import { makeMediaCursor } from "../db-operations/db-utils";
import { getMediaFilesByHash } from "../db-operations/search";
import { embedText, isSubString } from "./description";
import { updateDescription } from "../db-operations/update";
import { getFacesForMedia, getInsertFaceStmt, getInsertMediaStmt, getLastIdStmt } from "../db-operations/insert";
import { getHashSubdirectory } from "./utils";
import { moveOrCopy } from "../new-files/process-new-media";

const WANT = "tagasaurusfiles/data/tagasaurus.db";   // lower‑case, forward /

export async function openSourceDb(archivePath: string) {
  //workspace
  const workDir = await fs.mkdtemp(join(tmpdir(), "taga-import-"));
  const dbPath  = join(workDir, "tagasaurus.db");
  let   dbImport: Database | null = null;

  try {
    //extract one file, with verbose logging
    const gzip = /\.(?:tgz|tar\.gz)$/i.test(archivePath); // true only for .tgz/.tar.gz
    
    await tar.x({
        file  : archivePath,
        cwd   : workDir,
        gzip  ,
        strict: true,

        onentry(entry) {
            // <-- see *every* entry tar touches and where it writes it
            if (entry.path.includes("tagasaurus.db")) {
                console.log("tar entry:", entry.path);
            }
        },
        filter(p) {
            const ok = p === WANT || p.endsWith("/tagasaurus.db");
            if (ok) console.log("MATCH  -->", p);
            return ok;
        },
        strip: 2,
    });

    await fs.access(dbPath);                   // throws if still missing
    console.log("DB extracted to", dbPath);

    dbImport = new Database(`file:${dbPath}?mode=ro`);
    await dbImport.exec("PRAGMA cache_size=-16384;");
    await dbImport.exec("PRAGMA foreign_keys=ON;");

    //hand back handle + cleanup
    let cleaned = false;
    return {
      dbImport,
      workDir,
      async cleanup() {
        if (cleaned) return;
        
        cleaned = true;
        
        try { 
          if (dbImport) await dbImport.close(); 
        } catch {}

        await fs.rm(workDir, { recursive:true, force:true });
      }
    };

  } catch (err) {
    if (dbImport) { try { await dbImport.close(); } catch {} }
    await fs.rm(workDir, { recursive:true, force:true }).catch(()=>{});
    throw err;
  }

}




export async function demo(archivePath: string, db: Database, mediaDir: string) {
  const { dbImport, workDir, cleanup } = await openSourceDb(archivePath);

  const next = await makeMediaCursor(dbImport);

  const insertMediaStmt = await getInsertMediaStmt(db);
  const insertFaceStmt  = await getInsertFaceStmt(db);
  const lastIdStmt      = await getLastIdStmt(db);

  await db.exec("BEGIN");

  try {
    for (;;) {
      const newMedia = await next();  
      if (!newMedia) break;              // EOF

      console.log(
        `id=${newMedia.id},  hash=${newMedia.fileHash},  file=${newMedia.filename},  description=${newMedia.description}`
      );

      const origMedia = await  getMediaFilesByHash(db, [newMedia.fileHash]);

      if(origMedia.length) { //db has the same hash
        const origDescription = origMedia[0].description;
        const newDescription  = newMedia.description;

        if(!isSubString(origDescription, newDescription)) {
          const mergedDescription = `${origDescription ?? ""}<import>${newDescription}</import>`;
          const [mergedDescriptionEmbedding] = await embedText(mergedDescription);
          await updateDescription(db, mergedDescription, mergedDescriptionEmbedding, origMedia[0].fileHash);
        } //else ignore no other meta data there

      } else { //db does not have the same hash INSERT NEW media file with face embeddings

        const embeddingBlob = newMedia.descriptionEmbedding
                ? Buffer.from(
                    (newMedia.descriptionEmbedding instanceof Float32Array
                        ? newMedia.descriptionEmbedding
                        : new Float32Array(newMedia.descriptionEmbedding) //convert number[]
                    ).buffer
                    )
                : null;
             
        await insertMediaStmt.run([
          newMedia.fileHash,
          newMedia.filename,
          newMedia.fileType,
          newMedia.description,
          embeddingBlob
        ]);

        const { id: mediaFileId } = await lastIdStmt.get() as { id: number };
        
        const faces = await getFacesForMedia(dbImport, newMedia.id!);

        for (const f of faces) {
          await insertFaceStmt.run([
            mediaFileId,
            f.t ?? null,
            Buffer.from(f.emb.buffer),
            f.score,
            Buffer.from(f.bbox.buffer),
            Buffer.from(f.lms.buffer)
          ]);
        }

        // copy physical file from tempDir to MediaFiles/<hex tree>
        const subPath   = getHashSubdirectory(newMedia.fileHash); //eg a/3/e/7
        const finalDir  = join(mediaDir, subPath);
        const finalPath = join(finalDir, newMedia.fileHash); //no extension

        await fs.mkdir(finalDir, { recursive: true });
        const tmpFilePath = await extractOneMediaFile(archivePath, newMedia.fileHash, workDir);
        await moveOrCopy(tmpFilePath, finalPath);   // your EXDEV‑safe helper

      }

    }

    await db.exec("COMMIT");
    await insertMediaStmt.finalize();
    await insertFaceStmt.finalize();
    await lastIdStmt.finalize();

  } catch (e) {
    await db.exec("ROLLBACK");
    throw e;
  } finally {
    await next.close(); //calls stmt.finalize()
    await dbImport.close();
    await cleanup();
  }
  //await next.close();   //close prepared statement
  await dbImport.close();
  await cleanup();
}


async function extractOneMediaFile(
  archivePath: string,
  hash: string,
  destDir: string
): Promise<string> {
  const sub = getHashSubdirectory(hash); // a/3/e/7
  const tarPath = `TagasaurusFiles/MediaFiles/${sub}/${hash}`;

  await tar.x({
    file: archivePath,
    cwd : destDir,     // file will land here
    gzip: /\.(?:tgz|tar\.gz)$/i.test(archivePath),
    filter: p => p === tarPath,
    strip: 3           // drop TagasaurusFiles/MediaFiles/<sub>/
  });

  return join(destDir, hash);
}
