
import { type Database} from "libsql/promise";
import { defaultDBConfig } from "../initialization/init";
import { dedupPreserveOrder } from "../utils/utils";
import { SearchRow } from "../../types/variousTypes";
import { MediaFile } from "../../types/dbConfig";



const { tables, columns, indexes } = defaultDBConfig;
// helper: Float32Array -> Buffer without copies
const toBuf = (v: Float32Array) => Buffer.from(new Uint8Array(v.buffer)); //const toBuf = (v: Float32Array) => Buffer.from(v.buffer);

const Q_DESC = `
  SELECT  mf.file_hash      AS fileHash,
          mf.file_type      AS fileType,
          mf.description    AS description
  FROM   vector_top_k('${indexes.mediaFilesDescriptionEmbedding}', ?1, ?2) AS v
  JOIN   ${tables.mediaFiles} AS mf ON mf.id = v.id
`;

const Q_FACE = `
  SELECT  mf.file_hash   AS fileHash,
          mf.file_type   AS fileType,
          mf.description AS description
  FROM   vector_top_k('${indexes.faceEmbeddingsVector}', ?1, ?2) AS v
  JOIN   ${tables.faceEmbeddings} AS fe ON fe.id = v.id
  JOIN   ${tables.mediaFiles}     AS mf ON mf.id = fe.media_file_id
`;

let tempTableCreated = false;
let stmtDesc:  import('libsql/promise').Statement | null = null;
let stmtFace:  import('libsql/promise').Statement | null = null;

const TEMP_TABLE_SQL = `
  CREATE TEMP TABLE IF NOT EXISTS _tmp_media_hits (
      media_file_id INTEGER PRIMARY KEY  
  );
`;

//put the top-k matching face-embeddings into a TEMP table
const Q_FACE_HITS_INSERT = `
  INSERT OR IGNORE INTO _tmp_media_hits (media_file_id)
  SELECT DISTINCT fe.media_file_id
  FROM   vector_top_k('${indexes.faceEmbeddingsVector}', ?1, ?2) AS v
  JOIN   ${tables.faceEmbeddings} AS fe ON fe.id = v.id;
`;


//re-rank those hits by description-embedding distance
const Q_DESC_RERANK = `
  SELECT  mf.file_hash   AS fileHash,
          mf.file_type   AS fileType,
          mf.description AS description
  FROM   _tmp_media_hits mh
  JOIN   ${tables.mediaFiles} mf ON mf.id = mh.media_file_id
  WHERE  mf.${columns.mediaFiles.descriptionEmbedding} IS NOT NULL
  ORDER  BY vector_distance_cos(mf.description_embedding, ?1)
  LIMIT  ?2;
`;

let stmtFaceHitsInsert: import('libsql/promise').Statement | null = null;
let stmtDescRerank: import("libsql/promise").Statement | null = null;

//deals with multiple faces
export async function searchTagging(
  db: Database,
  descrEmb: Float32Array[] = [],
  faceEmb : Float32Array[] = [],
  k = 100
): Promise<SearchRow[]> {

  // allow only one modality at a time
  if (!descrEmb.length && !faceEmb.length) return [];

  if (!tempTableCreated) {
      await db.exec(TEMP_TABLE_SQL);
      tempTableCreated = true;
  }

  if (!stmtFaceHitsInsert) stmtFaceHitsInsert = await db.prepare(Q_FACE_HITS_INSERT);
  if (!stmtDesc) stmtDesc = await db.prepare(Q_DESC);
  if (!stmtFace) stmtFace = await db.prepare(Q_FACE);
  if (!stmtDescRerank) stmtDescRerank = await db.prepare(Q_DESC_RERANK);

  //HYBRID BRANCH of face and description
  if (descrEmb.length && faceEmb.length) {
    
    const descrVec = descrEmb[0];  // take the first (or only) description vector
    await db.exec(`DELETE FROM _tmp_media_hits;`);
    await db.exec("BEGIN TRANSACTION;");

    for (const fv of faceEmb) {
      await stmtFaceHitsInsert!.run([toBuf(fv), k]);
    }
    
    await db.exec("COMMIT");

    // re-rank the union by description similarity
    const rows = await stmtDescRerank!.all([toBuf(descrVec), k * faceEmb.length]) as SearchRow[];

    // nearest-first list of media_file hashes
    return rowsToUniqueMedia(rows);
  }

  if (descrEmb.length) {
      const rows = await stmtDesc!.all([ toBuf(descrEmb[0]), k ]) as SearchRow[];
      return rowsToUniqueMedia(rows);
  }

  if (faceEmb.length) {
    if (faceEmb.length === 1) {
      const rows = await stmtFace!.all([toBuf(faceEmb[0]), k]) as SearchRow[];
      return rowsToUniqueMedia(rows);          // ← was rows.map(...)
    }

    //run top-k search separately for every face vector
    const perFaceRows: SearchRow[][] = [];
    for (const fv of faceEmb) {
      perFaceRows.push(await stmtFace!.all([toBuf(fv), k]) as SearchRow[]);
    }

    //interleave the rows while de-duplicating
    const interleaved: SearchRow[] = [];
    for (let rank = 0; rank < k; rank++) {
      for (const rows of perFaceRows) {
        const row = rows[rank];
        if (row) interleaved.push(row);        // collect full objects
      }
    }

    return rowsToUniqueMedia(interleaved);
  }

  return [];
}

function rowsToUniqueMedia(rows: SearchRow[]): SearchRow[] {
  const seen = new Set<string>();         
  const uniq: SearchRow[] = [];
  for (const r of rows) {
    if (!seen.has(r.fileHash)) {
      seen.add(r.fileHash);
      uniq.push(r);
    }
  }
  return uniq;
}


export async function getMediaFilesByHash(
  db: Database,
  hashes: string[]
): Promise<MediaFile[]> {

  if (hashes.length === 0) return [];

  const { tables, columns } = defaultDBConfig;
  const placeholders = "(" + hashes.map(() => "?").join(",") + ")";

  const sql = `
    SELECT
      ${columns.mediaFiles.id}                  AS id,
      ${columns.mediaFiles.fileHash}            AS fileHash,
      ${columns.mediaFiles.filename}            AS filename,
      ${columns.mediaFiles.fileType}            AS fileType,
      ${columns.mediaFiles.description}         AS description,
      ${columns.mediaFiles.descriptionEmbedding} AS descriptionEmbedding
    FROM ${tables.mediaFiles}
    WHERE ${columns.mediaFiles.fileHash} IN ${placeholders};
  `;

  /* prepare → all()  (instead of db.all) */
  const stmt = await db.prepare(sql);
  const rows = await stmt.all(hashes) as {
    id: number;
    fileHash: string;
    filename: string;
    fileType: string;
    description: string | null;
    descriptionEmbedding: Buffer | null;
  }[];

  const mediaFiles: MediaFile[] = rows.map(r => ({
    id:          r.id,
    fileHash:    r.fileHash,
    filename:    r.filename,
    fileType:    r.fileType,
    description: r.description,
    descriptionEmbedding: r.descriptionEmbedding
      ? new Float32Array(
          r.descriptionEmbedding.buffer,
          r.descriptionEmbedding.byteOffset,
          r.descriptionEmbedding.byteLength / 4
        )
      : null
  }));

  // keep caller’s order
  const order = new Map(hashes.map((h, i) => [h, i]));
  mediaFiles.sort((a, b) => order.get(a.fileHash)! - order.get(b.fileHash)!);

  return mediaFiles;
}


