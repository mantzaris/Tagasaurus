import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import {type Database} from "libsql";
import { DBConfig } from "../../types/dbConfig"; // Adjust the import path accordingly
import { defaultDBConfig } from "../initialization/init";
/**
 * Computes the SHA-256 hash for the given file.
 * @param filePath - Absolute path to the file.
 * @returns The hexadecimal digest of the computed hash.
 */
function computeFileHash(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha256");
  hash.update(fileBuffer);
  return hash.digest("hex");
}

/**
 * Determines the file type based on its extension.
 * @param filename - The file name (e.g., "image.jpg").
 * @returns The file extension in lowercase (e.g., ".jpg").
 */
function determineFileType(filename: string): string {
  return path.extname(filename).toLowerCase();
}

/**
 * Processes a single file:
 * - Confirms the item is a file.
 * - Computes its hash.
 * - Moves the file from tempDir to mediaDir.
 * - Inserts a corresponding record into the database.
 * 
 * If the DB insertion fails after moving the file, the function attempts to revert the file move.
 *
 * @param file - The file name.
 * @param tempDir - The source directory of the file.
 * @param mediaDir - The destination directory.
 * @param db - The database instance passed as a parameter.
 * @returns True if the file was successfully processed; otherwise, false.
 */
function processFile(
  file: string,
  tempDir: string,
  mediaDir: string,
  db: Database
): boolean {
  const tempFilePath = path.join(tempDir, file);
  const destFilePath = path.join(mediaDir, file);

  try {
    // Check that the item is a file (skip directories)
    const stats = fs.statSync(tempFilePath);
    if (!stats.isFile()) {
      console.warn(`Skipping non-file: ${tempFilePath}`);
      return false;
    }

    // Compute the file's SHA-256 hash
    const fileHash = computeFileHash(tempFilePath);

    // Determine the file type based on its extension
    const fileType = determineFileType(file);

    // Move the file from the temp directory to the media directory
    fs.renameSync(tempFilePath, destFilePath);
    console.log(`Moved file "${file}" to the media directory.`);

    // Insert a record into the mediaFiles table.
    // Blank strings are used for description and descriptionEmbedding.
    const insertQuery = `
      INSERT INTO ${defaultDBConfig.tables.mediaFiles} 
        (${defaultDBConfig.columns.mediaFiles.fileHash}, ${defaultDBConfig.columns.mediaFiles.filename},
         ${defaultDBConfig.columns.mediaFiles.fileType}, ${defaultDBConfig.columns.mediaFiles.description},
         ${defaultDBConfig.columns.mediaFiles.descriptionEmbedding})
      VALUES (?, ?, ?, ?, ?)
    `;
    db.prepare(insertQuery).run(fileHash, file, fileType, "", "");
    console.log(`Inserted DB record for file "${file}".`);

    return true;
  } catch (error) {
    console.error(`Error processing file "${file}":`, error);

    // If the file was moved, attempt to revert it back to the temp directory.
    if (fs.existsSync(destFilePath) && !fs.existsSync(tempFilePath)) {
      try {
        fs.renameSync(destFilePath, tempFilePath);
        console.log(`Reverted file move for "${file}" due to an error.`);
      } catch (renameError) {
        console.error(`Failed to revert file move for "${file}":`, renameError);
      }
    }
    return false;
  }
}

/**
 * Processes all files in the temporary directory sequentially.
 * Each file is processed (moved and inserted into the DB) using the provided database instance.
 *
 * @param tempDir - Directory containing temporary files.
 * @param mediaDir - Destination directory where files should be moved.
 * @param db - The database instance used for the DB insertion.
 */
function processTempFiles(tempDir: string, mediaDir: string, db: Database): void {
  const files = fs.readdirSync(tempDir);

  for (const file of files) {
    const success = processFile(file, tempDir, mediaDir, db);
    if (!success) {
      console.error(`Failed to process file "${file}".`);
      // Depending on your application's requirements, decide whether to continue processing or halt.
    }
  }
}
