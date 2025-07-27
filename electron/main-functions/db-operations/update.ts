
import Database from "libsql/promise";


const updateStmtCache = new WeakMap<Database, Awaited<ReturnType<Database["prepare"]>>>();


export async function updateDescription(
  db: Database,
  desc: string,
  embedding: Float32Array | number[],
  hash: string
) {
  let stmt = updateStmtCache.get(db);
  if (!stmt) {
    stmt = await db.prepare(`
      UPDATE media_files
         SET description = ?, description_embedding = ?
       WHERE file_hash  = ?`);
    updateStmtCache.set(db, stmt);
  }

  const vec = embedding instanceof Float32Array
    ? embedding
    : new Float32Array(embedding);

  const blob = Buffer.from(vec.buffer);

  await stmt.run([desc, blob, hash]);
}



