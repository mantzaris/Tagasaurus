import fs from "fs/promises";
import path from "path";
import { type Database } from "libsql";
import { readdirp } from "readdirp";

import { defaultDBConfigFileQueue } from "../initialization/init";


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

    dbFileQueue.exec("BEGIN");
    try {
        const stmt = dbFileQueue.prepare(`INSERT OR IGNORE INTO ${defaultDBConfigFileQueue.tables.newPaths} (path) VALUES (?)`);
  
        for (const p of paths) {
            stmt.run(p);
        }
  
        dbFileQueue.exec("COMMIT");
    } catch (err) {
        dbFileQueue.exec("ROLLBACK");
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
      const row = dbFileQueue
        .prepare(`SELECT path FROM ${newPaths} LIMIT 1`)
        .get() as { path: string } | undefined;
  
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
            removeFromTable(dbFileQueue, newPaths, p);
          }
        } else if (stats.isFile()) {
          insertIntoTable(dbFileQueue, newFilePaths, p);
          removeFromTable(dbFileQueue, newPaths, p);
        } else {
          console.warn(`Skipping unsupported path: ${p}`);
          removeFromTable(dbFileQueue, newPaths, p);
        }
      } catch (err) {
        console.error(`Error reading path ${p}, removing from newPaths:`, err);
        removeFromTable(dbFileQueue, newPaths, p);
      }
  
      //once row is handled (file or directory), loop repeats, picking next row until `newPaths` is empty.
    }
}

async function addNewFilePathsDir(dbFileQueue: Database, dir: string): Promise<boolean> {
    const stmt = dbFileQueue.prepare(`INSERT OR IGNORE INTO ${defaultDBConfigFileQueue.tables.newFilePaths} (path) VALUES (?)`);

    dbFileQueue.exec("BEGIN");
    try {
        //readdirp(dir, options) returns an async iterator of "entry" objects
        for await (const entry of readdirp(dir, { type: "files" })) {
            stmt.run(entry.fullPath);
        }
        
        dbFileQueue.exec("COMMIT");
    } catch (err) {
        dbFileQueue.exec("ROLLBACK");
    }    
    
    return true;
}


/**
 * Copies each file in `newFilePaths` to `tempDir`, 
 * then removes it from `newFilePaths`.
 */
export async function copyToTempDir(dbFileQueue: Database, tempDir: string) {
    const { newFilePaths } = defaultDBConfigFileQueue.tables;
  
    const rows = dbFileQueue
        .prepare(`SELECT path FROM ${newFilePaths}`)
        .all() as { path: string }[];
  
    if (!rows || rows.length === 0) {
        console.log("No entries in newFilePaths to copy.");
        return;
    }
  
    for (const row of rows) {
        const sourcePath = row.path;
        const fileName = path.basename(sourcePath);
        const destination = path.join(tempDir, fileName);
    
        try {
            await fs.copyFile(sourcePath, destination);
            console.log(`Copied ${sourcePath} -> ${destination}`);    
            removeFromTable(dbFileQueue, newFilePaths, sourcePath);
        } catch (err) {
            console.error(`Failed to copy ${sourcePath} -> ${destination}:`, err);
            removeFromTable(dbFileQueue, newFilePaths, sourcePath);
        }
    }
}


/**
 * Helper: Insert a single path into a given table (synchronously)
 */
function insertIntoTable(dbFileQueue: Database, tableName: string, p: string) {
    dbFileQueue.exec("BEGIN");
    try {
        dbFileQueue
          .prepare(`INSERT OR IGNORE INTO ${tableName} (path) VALUES (?)`)
          .run(p);
        dbFileQueue.exec("COMMIT");
    } catch (err) {
        dbFileQueue.exec("ROLLBACK");
        console.error(`Failed to insert ${p} into ${tableName}`, err);
    }
}
  
/**
 * Helper: Remove a single path from a given table (synchronously)
 */
function removeFromTable(dbFileQueue: Database, tableName: string, p: string) {
    dbFileQueue.exec("BEGIN");
    try {
        dbFileQueue
        .prepare(`DELETE FROM ${tableName} WHERE path = ?`)
        .run(p);
        dbFileQueue.exec("COMMIT");
    } catch (err) {
        dbFileQueue.exec("ROLLBACK");
        console.error(`Failed to remove ${p} from ${tableName}`, err);
    }
}
  