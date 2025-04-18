import { type Database } from 'libsql/promise';

/**
 * save description and its embedding vector for the single media file of the hash
 *
 * @param db          open libsql/promise Database
 * @param fileHash    SHA‑256 (or whatever) hash used as primary lookup key
 * @param description new free‑text description
 * @param embedding   vector as JS number[] (length = 384 for MiniLM‑L6)
 */
export async function saveMediaDescription(
  db: Database,
  fileHash: string,
  description: string,
  embedding: number[],
): Promise<void> {
  const blob = Buffer.from(new Float32Array(embedding).buffer);

  const stmt = await db.prepare(`
    UPDATE media_files
    SET description           = ?,
        description_embedding = ?
    WHERE file_hash = ?
  `);
  await stmt.run([description, blob, fileHash]);
}
