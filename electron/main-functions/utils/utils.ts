import * as fs from "fs";
import * as path from "path";

import { createHash } from "crypto";
import { loadEsm } from 'load-esm';


export function computeFileHash(filePath: string, hashAlgorithm: string = "sha256"): string {
  console.log(`in computeFileHash filepath = ${filePath}`)
  const fileBuffer = fs.readFileSync(filePath);
  return createHash(hashAlgorithm)
    .update(fileBuffer)
    .digest("hex");
}

/**
 * use only the first 12KB for detection
 */
export async function detectTypeFromPartialBuffer(filePath: string) {
  const fd = fs.openSync(filePath, 'r');
  const chunkSize = 12288;
  const buffer = Buffer.alloc(chunkSize);

  //read from the start of the file
  fs.readSync(fd, buffer, 0, chunkSize, 0);
  fs.closeSync(fd);

  //use loadEsm to dynamically import file-type as ESM
  const { fileTypeFromBuffer } = await loadEsm<typeof import('file-type')>('file-type');

  const fileTypeResult = await fileTypeFromBuffer(buffer);
  return fileTypeResult ?? {ext: undefined, mime: 'application/octet-stream'};
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

