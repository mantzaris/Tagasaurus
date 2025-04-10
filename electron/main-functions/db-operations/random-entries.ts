import { promises as fs } from "fs";
import path from "path";

import { type Database } from "libsql/promise";
import { type MediaFile } from "../../types/dbConfig";



/**
 * Returns up to `numberOfEntries` random MediaFile rows from the DB
 * if row_count <= 20*(16^4) ~ 1.3e6, do `ORDER BY RANDOM()`
 * else pick random 4-hex-digit subdirectories under `mediaDir`
 * gather file hashes, and fetch these from `media_files`
 *
 * @param db        open libsql/promise Database
 * @param mediaDir  top-level media directory containing 4-level hex subdirs
 * @param numberOfEntries needed number of random rows (max)
 */
export async function getRandomEntries(
  db: Database,
  mediaDir: string,
  numberOfEntries: number
): Promise<MediaFile[]> {
  
  const threshold = 20 * (16 ** 4); // ~1,310,720

  const stmt = await db.prepare(`
    SELECT row_count AS rc
    FROM db_stats
    WHERE table_name = 'media_files'
  `);

  const row = await stmt.get<{ rc: number }>();
  const rowCount = row?.rc ?? 0;

  //if rowCount is small enough, do an ORDER BY RANDOM() query
  if (rowCount <= threshold) {

    const stmtRandom = await db.prepare(`
      SELECT
        id,
        file_hash               AS fileHash,
        filename,
        file_type               AS fileType,
        description,
        description_embedding   AS descriptionEmbedding
      FROM media_files
      ORDER BY RANDOM()
      LIMIT ?
    `);

    const rows = await stmtRandom.all<MediaFile>([ numberOfEntries ]);

    return rows || [];
  }  

  //pick random subdirectories from the 4-level hex structure
  //gather file hashes (the files are typically named by their hash)
  const chosenHashes = new Set<string>();
  const needed = numberOfEntries;

  //pick a random hex digit
  function randomHexChar(): string {
      const HEX = "0123456789abcdef";
      return HEX[Math.floor(Math.random() * HEX.length)];
  }

  //try up to 10 subdirectories, or until enough hashes
  for (let attempt = 0; attempt < 10 && chosenHashes.size < needed; attempt++) {
    //build a random 4-char hex path: eg. "a/3/e/7"
    const subDir = path.join(
      mediaDir,
      randomHexChar(),
      randomHexChar(),
      randomHexChar(),
      randomHexChar()
    );

    try {      
      const fileNames = await fs.readdir(subDir);

      //it is empty so skip
      if (fileNames.length === 0) {
        continue;
      }

      //pick random entries from fileNames
      let fileCountToPick = Math.min(fileNames.length, needed - chosenHashes.size);

      //pick in random order
      for (let i = fileNames.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [fileNames[i], fileNames[j]] = [fileNames[j], fileNames[i]];
      }

      //take up to fileCountToPick from the front of fileNames
      for (let i = 0; i < fileCountToPick; i++) {
        chosenHashes.add(fileNames[i]);
      }

    } catch (err) {
      //if the directory doesn't exist or read fails, just ignore & continue
      //console.error("Error reading directory:", subDir, err);
    }
  }

  //found no hashes, return empty
  if (chosenHashes.size === 0) {
    return [];
  }

  //now fetch the chosen entries from the DB by their fileHash
  //build a parameterized "IN" clause
  const finalHashes = Array.from(chosenHashes).slice(0, numberOfEntries); // ensure we don't exceed needed
  const placeholders = finalHashes.map(() => "?").join(",");

  const stmtGetHashes = `
    SELECT
      id,
      file_hash             AS fileHash,
      filename,
      file_type             AS fileType,
      description,
      description_embedding AS descriptionEmbedding
    FROM media_files
    WHERE file_hash IN (${placeholders})
  `;

  const stmt3 = await db.prepare<MediaFile>(stmtGetHashes);
  const rows = await stmt3.all<MediaFile>(finalHashes);

  return rows || [];
}
