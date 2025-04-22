import fs from "fs/promises";
import { constants } from "fs";
import path from "path";
import crypto from "crypto";
import { type Database } from "libsql/promise";

import { readdirp } from "readdirp";

import { defaultDBConfigFileQueue } from "../initialization/init";
import { validatePath } from "../utils/utils";


/**
 * Add an array of file/directory paths to the `newPaths` table, 
 * ignoring any duplicates
 * 
 * @param dbFileQueue - Database instance for fileQueue.db
 * @param paths       - array of path strings
 * @param tempDir     - string of the directory for the temporary files before processing
 */
export async function addNewPaths(dbFileQueue: Database, paths: string[], tempDir: string): Promise<void> {
    if (!paths || paths.length === 0) return;

    await dbFileQueue.exec("BEGIN");
    try {
        const stmt = await dbFileQueue.prepare(`INSERT OR IGNORE INTO ${defaultDBConfigFileQueue.tables.newPaths} (path) VALUES (?)`);
  
        for (const p of paths) {

            const real = await validatePath(p);
            if (!real) continue; // skip invalid or symlink

            await stmt.run(real);
        }
  
        await dbFileQueue.exec("COMMIT");
    } catch (err) {
        await dbFileQueue.exec("ROLLBACK");
        console.error("Error inserting newPaths:", err);
        return;
    }

    await pathsToNewFilePaths(dbFileQueue, tempDir);
}

/**
 * 1) Fetch each entry from the `newPaths` table.
 * 2) Check if it's a file or directory:
 *    - If file => add to `newFilePaths`, remove from `newPaths`.
 *    - If directory => call `addNewFilePathsDir`, then remove from `newPaths`.
 * 3) After finishing, call `copyToTempDir`.
 */
export async function pathsToNewFilePaths(dbFileQueue: Database, tempDir: string): Promise<void> {
    const { newPaths, newFilePaths } = defaultDBConfigFileQueue.tables;
  
    while (true) {
      //fetch a single row from newPaths
      const stmt = await dbFileQueue.prepare(`SELECT path FROM ${newPaths} LIMIT 1`);
      const row = await stmt.get() as { path: string } | undefined;

      if (!row) { //0 rows left in newPaths
        await copyToTempDir(dbFileQueue, tempDir);
        return; //break from loop and function
      }

      const p = row.path;
      try {

        const stats = await fs.stat(p);
  
        if (stats.isDirectory()) {
          //expand all files in this directory into newFilePaths
          const success = await addNewFilePathsDir(dbFileQueue, p);
          if (success) {
            await removeFromTable(dbFileQueue, newPaths, p);
          }
        } else if (stats.isFile()) {
          await insertIntoTable(dbFileQueue, newFilePaths, p);
          await removeFromTable(dbFileQueue, newPaths, p);
        } else {
          console.warn(`Skipping unsupported path: ${p}`);
          await removeFromTable(dbFileQueue, newPaths, p);
        }
      } catch (err) {
        console.error(`Error reading path ${p}, removing from newPaths:`, err);
        await removeFromTable(dbFileQueue, newPaths, p);
      }
  
      //once row is handled (file or directory), loop repeats, picking next row until `newPaths` is empty
    }
}

async function addNewFilePathsDir(dbFileQueue: Database, dir: string): Promise<boolean> {
    const stmt = await dbFileQueue.prepare(`INSERT OR IGNORE INTO ${defaultDBConfigFileQueue.tables.newFilePaths} (path) VALUES (?)`);

    await dbFileQueue.exec("BEGIN");
    try {
        //readdirp(dir, options) returns an async iterator of "entry" objects
        for await (const entry of readdirp(dir, { type: "files" })) {
            await stmt.run(entry.fullPath);
        }
        
        await dbFileQueue.exec("COMMIT");
    } catch (err) {
        await dbFileQueue.exec("ROLLBACK");
    }    
    
    return true;
}


/**
 * Copies each file in `newFilePaths` to `tempDir`, 
 * then removes it from `newFilePaths`.
 */
export async function copyToTempDir(dbFileQueue: Database, tempDir: string) {
    const { newFilePaths } = defaultDBConfigFileQueue.tables;
  
    const stmt = await dbFileQueue.prepare(`SELECT path FROM ${newFilePaths}`);
    const rows = await stmt.all() as { path: string }[];
  
    if (!rows || rows.length === 0) {
        console.log("No entries in newFilePaths to copy.");
        return;
    }
  
    for (const row of rows) {
        const sourcePath = row.path;
        const fileName = path.basename(sourcePath);
        const destination = path.join(tempDir, fileName);
    
        try {
            await safeCopyFile(sourcePath, destination);
            console.log(`Copied ${sourcePath} -> ${destination}`);    
            await removeFromTable(dbFileQueue, newFilePaths, sourcePath);
        } catch (err) {
            console.error(`Failed to copy ${sourcePath} -> ${destination}:`, err);
            await removeFromTable(dbFileQueue, newFilePaths, sourcePath);
        }
    }
}

/**
 * attempt to copy a file using COPYFILE_EXCL (no overwrite)
 * if EEXIST occurs, generate a new filename with a short hash suffix and retry
 */
async function safeCopyFile(source: string, dest: string) {
    let tries = 0;
    
    while (tries < 10) {
      try {
        await fs.copyFile(source, dest, constants.COPYFILE_EXCL);
        return;
      } catch (err: any) {
        if (err.code === "EEXIST") {
          dest = uniqueSuffixName(dest);
          tries++;
        } else {
          throw err; 
        }
      }
    }
}

/**
 * append short hash suffix to the provided destination path 
 * and avoid collision, e.g., "cat.png" -> "cat-a1b2c3d4.png"
 */
function uniqueSuffixName(destPath: string): string {
    const dir = path.dirname(destPath);
    const ext = path.extname(destPath);
    const base = path.basename(destPath, ext);
  
    //make a short random hash
    const randomHash = crypto.randomBytes(8).toString("hex");
    const newBase = `${base}-${randomHash}${ext}`;
    return path.join(dir, newBase);
}

/**
 * Helper: Insert a single path into a given table (synchronously)
 */
async function insertIntoTable(dbFileQueue: Database, tableName: string, p: string) {
    await dbFileQueue.exec("BEGIN");
    try {
        const stmt = await dbFileQueue.prepare(`INSERT OR IGNORE INTO ${tableName} (path) VALUES (?)`);
        await stmt.run(p);
        await dbFileQueue.exec("COMMIT");
    } catch (err) {
        await dbFileQueue.exec("ROLLBACK");
        console.error(`Failed to insert ${p} into ${tableName}`, err);
    }
}
  
/**
 * Helper: Remove a single path from a given table (synchronously)
 */
async function removeFromTable(dbFileQueue: Database, tableName: string, p: string) {
    await dbFileQueue.exec("BEGIN");

    try {
        const stmt = await dbFileQueue.prepare(`DELETE FROM ${tableName} WHERE path = ?`);
        await stmt.run(p);
        await dbFileQueue.exec("COMMIT");
    } catch (err) {
        await dbFileQueue.exec("ROLLBACK");
        console.error(`Failed to remove ${p} from ${tableName}`, err);
    }
}
  