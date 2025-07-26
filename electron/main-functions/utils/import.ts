
import * as tar from "tar";
import { tmpdir } from "os";
import { join }    from "path";
import { promises as fs } from "fs";
import Database    from "libsql/promise";
import { makeMediaCursor } from "../db-operations/db-utils";

const WANT = "tagasaurusfiles/data/tagasaurus.db";   // lower‑case, forward /

export async function openSourceDb(archivePath: string) {
  //workspace
  const workDir = await fs.mkdtemp(join(tmpdir(), "taga-import-"));
  const dbPath  = join(workDir, "tagasaurus.db");
  let   db_import: Database | null = null;

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

    db_import = new Database(`file:${dbPath}?mode=ro`);
    await db_import.exec("PRAGMA cache_size=-16384;");
    await db_import.exec("PRAGMA foreign_keys=ON;");

    //hand back handle + cleanup
    let cleaned = false;
    return {
      db_import,
      async cleanup() {
        if (cleaned) return;
        
        cleaned = true;
        
        try { 
          if (db_import) await db_import.close(); 
        } catch {}

        await fs.rm(workDir, { recursive:true, force:true });
      }
    };

  } catch (err) {
    if (db_import) { try { await db_import.close(); } catch {} }
    await fs.rm(workDir, { recursive:true, force:true }).catch(()=>{});
    throw err;
  }

  
}




export async function demo(archivePath: string) {
  const { db_import, cleanup } = await openSourceDb(archivePath);

  const next = await makeMediaCursor(db_import);

  for (;;) {
    const media = await next();  
    if (!media) break;              // EOF

    console.log(
      `id=${media.id},   hash=${media.fileHash},   file=${media.filename},   description=${media.description}`
    );
  }

  // await next.close();   //close prepared statement
  await db_import.close();
  await cleanup();
}

