
import { type Database} from "libsql/promise";
import { defaultDBConfig } from "../initialization/init";

type Row = { fileHash: string };

const { tables, columns, indexes } = defaultDBConfig;
// helper: Float32Array -> Buffer without copies
const toBuf = (v: Float32Array) => Buffer.from(v.buffer);

const Q_DESC = `
  SELECT mf.file_hash AS fileHash
  FROM   vector_top_k('${indexes.mediaFilesDescriptionEmbedding}', ?1, ?2) AS v
  JOIN   ${tables.mediaFiles} AS mf ON mf.id = v.id
  ORDER  BY v.distance; 
`;

const Q_FACE = `
  SELECT mf.file_hash AS fileHash
  FROM   vector_top_k('${indexes.faceEmbeddingsVector}', ?1, ?2) AS v
  JOIN   ${tables.faceEmbeddings} AS fe ON fe.id = v.id
  JOIN   ${tables.mediaFiles}     AS mf ON mf.id = fe.media_file_id
  ORDER  BY v.distance;
`;

let stmtDesc:  import('libsql/promise').Statement | null = null;
let stmtFace:  import('libsql/promise').Statement | null = null;


//put the top-k matching face-embeddings into a TEMP table
const Q_FACE_HITS = `
  CREATE TEMP TABLE IF NOT EXISTS _tmp_face_hits(id INTEGER PRIMARY KEY);
  DELETE FROM _tmp_face_hits;

  INSERT INTO _tmp_face_hits
  SELECT id
  FROM   vector_top_k('face_embeddings_face_embedding_idx', ?1, ?2);
`;

//re-rank those hits by description-embedding distance
const Q_DESC_RERANK = `
  SELECT mf.file_hash AS fileHash
  FROM   _tmp_face_hits fh
  JOIN   media_files AS mf ON mf.id = fh.id
  ORDER  BY vector_distance_cos(mf.description_embedding, ?1)
  LIMIT  ?2;
`;

let stmtFaceHits  : import("libsql/promise").Statement | null = null;
let stmtDescRerank: import("libsql/promise").Statement | null = null;

//TODO: deal with multiple faces
export async function searchTagging(
  db: Database,
  descrEmb: Float32Array[] = [],
  faceEmb : Float32Array[] = [],
  k = 100
): Promise<string[]> {

  // allow only one modality at a time
  if (!descrEmb.length && !faceEmb.length) return [];

  if (!stmtDesc) stmtDesc = await db.prepare(Q_DESC);
  if (!stmtFace) stmtFace = await db.prepare(Q_FACE);
  if (!stmtFaceHits)   stmtFaceHits   = await db.prepare(Q_FACE_HITS);
  if (!stmtDescRerank) stmtDescRerank = await db.prepare(Q_DESC_RERANK);

  if (descrEmb.length && faceEmb.length) {
    const faceVec  = faceEmb[0];   // take the first (or only) face embedding
    const descrVec = descrEmb[0];  // take the first (or only) description vector
    if (!faceVec || !descrVec) return [];   
    //populate temp table with top-k face hits
    await stmtFaceHits.all([ toBuf(faceVec), k ]);

    //re-rank that set by description similarity
    const rows = await stmtDescRerank.all([ toBuf(descrVec), k ]) as Row[];

    // nearest-first list of media_file hashes
    return rows.map(r => r.fileHash);
  }

  if (descrEmb.length) {
      const rows = await stmtDesc!.all([ toBuf(descrEmb[0]), k ]) as Row[];
      return rows.map(r => r.fileHash);
  }

  if(faceEmb.length) {
    // face-only branch two-step lookup
    const rows = await stmtFace!.all([ toBuf(faceEmb[0]), k ]) as Row[];
    return rows.map(r => r.fileHash);
  }

  return [];
}