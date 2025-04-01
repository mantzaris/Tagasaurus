import fs, {open} from "fs/promises"; //import * as fs from "fs";
import * as path from "path";

import { createHash } from "crypto";
import { loadEsm } from 'load-esm';


export async function computeFileHash(filePath: string, hashAlgorithm: string = "sha256"): Promise<string> {
  
  const fileBuffer = await fs.readFile(filePath);
  return createHash(hashAlgorithm)
    .update(fileBuffer)
    .digest("hex");
}

/**
 * use only the first 12KB for detection
 */
export async function detectTypeFromPartialBuffer(filePath: string) {
  
  const chunkSize = 12288;
  const buffer = Buffer.alloc(chunkSize);

  const fh = await open(filePath, "r");

  //read from the start of the file
  try {
    // 2) Read up to `chunkSize` bytes starting at position 0
    //    handle.read(...) is asynchronous
    await fh.read(buffer, 0, chunkSize, 0);
  } finally {
    // 3) Always close the file (in a finally block so it closes even if there's an error)
    await fh.close();
  }

  // 4) Dynamically load `file-type`
  const { fileTypeFromBuffer } = await loadEsm<typeof import("file-type")>("file-type");

  // 5) Pass the buffer to fileType
  const fileTypeResult = await fileTypeFromBuffer(buffer);
  return fileTypeResult ?? { ext: undefined, mime: "application/octet-stream" };
}

/**
 * given a file hash, returns the 4-level-deep directory path
 * e.g. hash = "a3e71df2...", then becomes subpath = "a/3/e/7"
 */
export function getHashSubdirectory(hash: string): string {
  // First 4 characters for 4 levels: each is a single hex digit in "0-9a-f"
  const c1 = hash[0];
  const c2 = hash[1];
  const c3 = hash[2];
  const c4 = hash[3];
  return path.join(c1, c2, c3, c4);
}

