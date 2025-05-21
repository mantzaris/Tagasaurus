import fs, {open} from "fs/promises"; //import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import { Readable } from 'stream';


import { createHash } from "crypto";
import { loadEsm } from 'load-esm';

import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';


ffmpeg.setFfmpegPath(ffmpegPath || "");


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
    //read up to `chunkSize` bytes starting at position 0
    //handle.read(...) is asynchronous
    await fh.read(buffer, 0, chunkSize, 0);
  } finally {
    //close the file (in a finally block so it closes even if there's an error)
    await fh.close();
  }

  //dynamically load `file-type`
  const { fileTypeFromBuffer } = await loadEsm<typeof import("file-type")>("file-type");

  //pass the buffer to fileType
  const fileTypeResult = await fileTypeFromBuffer(buffer);
  return fileTypeResult ?? { ext: undefined, mime: "application/octet-stream" };
}

/**
 * given a file hash, returns the 4-level-deep directory path
 * eg hash = "a3e71df2...", then becomes subpath = "a/3/e/7"
 */
export function getHashSubdirectory(hash: string): string {
  //first 4 characters for 4 levels: each is a single hex digit in "0-9a-f"
  const c1 = hash[0];
  const c2 = hash[1];
  const c3 = hash[2];
  const c4 = hash[3];
  return path.join(c1, c2, c3, c4);
}


/**
 * convert a directory path to a properly formatted file:// URL with a trailing slash
 * @param {string} mediaDir - absolute path to the media directory
 * @returns {string} - file URL representing the media directory
 */
export function getMediaFrontEndDirBase(mediaDir: string) {
  //convert directory path to a file URL
  let baseUrl = pathToFileURL(mediaDir).href;
  //ensure trailing slash to correctly join file names in frontend/ui/renderer
  if (!baseUrl.endsWith('/')) {
    baseUrl += '/';
  }

  return baseUrl;
}


/** Regex for characters that are invalid or dangerous in file names            */
/** (Ctrl chars \x00–\x1F, Windows < > : " | ? *, and ASCII DEL \x7F).          */
export const BAD_CHARS = /[<>:"|?*\x00-\x1F\x7F]/;

/** Fast, platform‑agnostic path hygiene                                        */
export async function validatePath(p: string): Promise<string | undefined> {
  // 1) Normalise & strip trailing separators
  const normal = path.normalize(p).replace(/[\\\/]+$/, "");

  // 2) Cheap string checks ----------------------------------------------------
  if (
    normal.includes("..") ||          // directory traversal fragments
    BAD_CHARS.test(normal) ||         // control / reserved chars
    normal.length === 0               // empty after normalise
  ) {
    console.warn("Rejecting bad path string:", p);
    return;
  }

  // 3) Reject symbolic links --------------------------------------------------
  try {
    const st = await fs.lstat(normal);
    if (st.isSymbolicLink()) {
      console.warn("Rejecting symlink:", p);
      return;
    }
  } catch (e) {
    console.warn("Path not readable:", p, e);
    return;                            // unreadable → treat as invalid
  }

  // 4) Pass - return the canonical absolute path (realpath resolves junctions)
  return fs.realpath(normal);
}


export async function ensureBuffer(src: Buffer | Readable): Promise<Buffer> {
  if (Buffer.isBuffer(src)) return src;
  const chunks: Buffer[] = [];
  for await (const c of src) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

export const asReadable = (src: Buffer | Readable): Readable =>
  Buffer.isBuffer(src) ? Readable.from([src]) : src;


export function cosineF32(u: Float32Array, v: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < u.length; ++i) dot += u[i] * v[i];
  return dot;                         // works because u, v are L2-normalised
};