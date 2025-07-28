

import type { Database } from "libsql/promise";
import { MediaFile } from "../../types/dbConfig";
import { TimedEmbedding } from "../utils/face-utils";


//cache prepared statements per‑DB
const insertMediaStmtCache = new WeakMap<Database, Awaited<ReturnType<Database["prepare"]>>>();
const insertFaceStmtCache  = new WeakMap<Database, Awaited<ReturnType<Database["prepare"]>>>();
const lastIdStmtCache = new WeakMap<Database, Awaited<ReturnType<Database["prepare"]>>>();

export async function getInsertMediaStmt(db: Database) {
  let st = insertMediaStmtCache.get(db);
  if (!st) {
    st = await db.prepare(`
        INSERT INTO media_files
          (file_hash, filename, file_type, description, description_embedding)
        VALUES (?, ?, ?, ?, ?)
    `);
    insertMediaStmtCache.set(db, st);
  }
  return st;
}


export async function getInsertFaceStmt(db: Database) {
  let st = insertFaceStmtCache.get(db);
  if (!st) {
    st = await db.prepare(`
        INSERT INTO face_embeddings
          (media_file_id, time_sec, face_embedding, score, bbox, landmarks)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertFaceStmtCache.set(db, st);
  }
  return st;
}


export async function getLastIdStmt(db: Database) {
  let st = lastIdStmtCache.get(db);
  if (!st) {
    st = await db.prepare("SELECT last_insert_rowid() AS id");
    lastIdStmtCache.set(db, st);
  }
  return st;
}


//get all the already processed face embeddings
export async function getFacesForMedia(db: Database, mediaId: number): Promise<TimedEmbedding[]> {
  const stmt = await db.prepare(`
    SELECT time_sec, face_embedding, score, bbox, landmarks
      FROM face_embeddings
     WHERE media_file_id = ?
  `);

  const rows = await stmt.all([mediaId]) as {
    time_sec: number | null;
    face_embedding: Buffer;
    score: number;
    bbox: Buffer;
    landmarks: Buffer;
  }[];
  
  return rows.map(r => {
    const faceBuf = Buffer.from(r.face_embedding);
    const bboxBuf = Buffer.from(r.bbox);
    const lmsBuf  = Buffer.from(r.landmarks);

    return {
      t: r.time_sec,
      emb: new Float32Array(faceBuf.buffer, faceBuf.byteOffset, faceBuf.byteLength / 4),
      score: r.score,
      bbox: new Float32Array(bboxBuf.buffer, bboxBuf.byteOffset, bboxBuf.byteLength / 4),
      lms: new Float32Array(lmsBuf.buffer, lmsBuf.byteOffset, lmsBuf.byteLength / 4)
    };
  });
}



// export async function insertNewMediaWithFaces(
//   db: Database,
//   media: Omit<MediaFile, "id">,          
//   faces: TimedEmbedding[] //0‑N faces for this media file
// ): Promise<number> { //returns media_files.id
  
//   let mediaStmt = insertMediaStmtCache.get(db);
  
//   if (!mediaStmt) {
//     mediaStmt = await db.prepare(`
//         INSERT INTO media_files
//           (file_hash, filename, file_type, description, description_embedding)
//         VALUES (?, ?, ?, ?, ?)`);
//     insertMediaStmtCache.set(db, mediaStmt);
//   }

//   let faceStmt = insertFaceStmtCache.get(db);

//   if (!faceStmt) {
//     faceStmt = await db.prepare(`
//         INSERT INTO face_embeddings
//           (media_file_id, time_sec, face_embedding, score, bbox, landmarks)
//         VALUES (?, ?, ?, ?, ?, ?)`);
//     insertFaceStmtCache.set(db, faceStmt);
//   }


//   await db.exec("BEGIN");
//   try {
//     const embeddingBlob = media.descriptionEmbedding
//                 ? Buffer.from(
//                     (media.descriptionEmbedding instanceof Float32Array
//                         ? media.descriptionEmbedding
//                         : new Float32Array(media.descriptionEmbedding) //convert number[]
//                     ).buffer
//                     )
//                 : null;

//     /* insert media row */
//     await mediaStmt.run([
//       media.fileHash,
//       media.filename,
//       media.fileType,
//       media.description,
//       embeddingBlob
//     ]);

//     // last_insert_rowid() gives us the new primary key
//     const { id: mediaFileId } =
//       (await db.get<{ id: number }>("SELECT last_insert_rowid() AS id"))!;

//     //insert face rows (if any)
//     for (const f of faces) {
//       await faceStmt.run([
//         mediaFileId,
//         f.t ?? null,
//         Buffer.from(f.emb.buffer),
//         f.score,
//         Buffer.from(f.bbox.buffer),
//         Buffer.from(f.lms.buffer)
//       ]);
//     }

//     await db.exec("COMMIT");
//     return mediaFileId;
//   } catch (e) {
//     await db.exec("ROLLBACK");
//     throw e;
//   }
// }
