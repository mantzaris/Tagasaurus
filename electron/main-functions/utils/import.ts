
import * as tar from "tar";
import { tmpdir } from "os";
import { join }    from "path";
import { promises as fs } from "fs";
import Database    from "libsql/promise";

const WANT = "tagasaurusfiles/data/tagasaurus.db";   // lower‑case, forward /

export async function openSourceDb(archivePath: string) {
  //workspace
  const workDir = await fs.mkdtemp(join(tmpdir(), "taga-import-"));
  const dbPath  = join(workDir, "tagasaurus.db");
  let   db: Database | null = null;

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

    db = new Database(`file:${dbPath}?mode=ro`);
    await db.exec("PRAGMA cache_size=-16384;");
    await db.exec("PRAGMA foreign_keys=ON;");

    //hand back handle + cleanup
    let cleaned = false;
    return {
      db,
      async cleanup() {
        if (cleaned) return;
        
        cleaned = true;
        
        try { 
          if (db) await db.close(); 
        } catch {}

        await fs.rm(workDir, { recursive:true, force:true });
      }
    };

  } catch (err) {
    if (db) { try { await db.close(); } catch {} }
    await fs.rm(workDir, { recursive:true, force:true }).catch(()=>{});
    throw err;
  }
}



/**
 * Fetch the first media_files row *after* `lastRowid`.
 * Returns `undefined` when there are no more rows.
 *
 * This version mirrors the structure of `addNewPaths`:
 *   • prepare the statement
 *   • execute it (stmt.get) with the bound value
 *   • finalize the statement
 */
export async function nextMediaRow(
  db: Database,
  lastRowid: number
): Promise<{ rid: number; id: number } | undefined> {
  // 1. prepare once for this call
  const stmt = await db.prepare(`
      SELECT rowid AS rid, id
        FROM media_files
       WHERE rowid > ?
    ORDER BY rowid
       LIMIT 1
  `);

  // 2. run the query with the bound parameter
  const row = (await stmt.get([lastRowid])) as
    | { rid: number; id: number }
    | undefined;

  
  return row;          // undefined when no more rows
}


export async function demo(archive: string) {
  const { db: src, cleanup } = await openSourceDb(archive);

  let last = 0;
  while (true) {
    const row = await nextMediaRow(src, last);   // O(1) query
    if (!row) break;
    console.log("rowid", row.rid, "media_id", row.id);
    last = row.rid;
  }

  await src.close();
  await cleanup();
}

