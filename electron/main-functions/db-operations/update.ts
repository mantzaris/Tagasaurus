
import Database from "libsql/promise";
import { getMediaFilesByHash } from "./search";


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




const TAGA_PNG_HASH   = "c5f85a80b163528809da47f92c06b7c0fb0c7032e313a7964a3f3f1f23bceebb";
const TAGA_TALK = `This is Taga, Tagasaurus

Taga heard this:

Linus Torvalds, "Talk is cheap, show me the code" > why-is-it-cheap?

Martti Malmi, "Code speaks louder than Words" > why-is-it-louder?

Marshall McLuhan, "the-Medium-is-the-Message"


Chaos. Good news.`;


export async function ensureTagaTalk(db: Database) {
  const rows = await getMediaFilesByHash(db, [TAGA_PNG_HASH]);
  if (rows.length === 0) return;

  const mf       = rows[0];
  const current  = mf.description ?? "";
  if (current.includes(TAGA_TALK)) return;           // already contains text

  const patched = current.trim().length > 0 ? `${current.trim()} ${TAGA_TALK}` : TAGA_TALK;

  const stmt = await db.prepare(`UPDATE media_files SET description = ? WHERE file_hash = ?`);
  await stmt.run([TAGA_TALK, TAGA_PNG_HASH]);
}