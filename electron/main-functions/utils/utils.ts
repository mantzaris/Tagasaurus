import fs, {open} from "fs/promises"; //import * as fs from "fs";
import * as path from "path";

import { createHash, randomBytes } from "crypto";
import { loadEsm } from 'load-esm';
import sharp from 'sharp';

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
  // First 4 characters for 4 levels: each is a single hex digit in "0-9a-f"
  const c1 = hash[0];
  const c2 = hash[1];
  const c3 = hash[2];
  const c4 = hash[3];
  return path.join(c1, c2, c3, c4);
}



const allowedImageMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
];

//currently: images, videos, audio, and PDFs are allowed
export function isAllowedFileType(mime: string): boolean {  
  if (mime.startsWith("image/")) {
    if(allowedImageMimeTypes.includes(mime)) {
      return true;
    }

    return false;
  }
  if (mime.startsWith("video/")) {
    return true;
  }
  if (mime.startsWith("audio/")) {
    return true;
  }
  if (mime === "application/pdf") {
    return true;
  }

  return false;
}


export async function convertMediaFile(
  mime: string,
  filePath: string,
  dirPath: string,
  fileName: string): Promise<{ newFilePath: string; newFileName: string; newMime: string } | false> {

    if (mime.startsWith("image/")) {
      return await convertToPNG(filePath,dirPath,fileName);
    } 

    return false;
}

/**
 * attempts to convert an image to PNG if it is not in the whitelist
 * creates a new file with a random hex suffix and .png extension
 *
 * @param filePath path to the file
 * @param dirPath  directory path where the file currently resides
 * @param fileName existing file name (e.g. "photo.heic")
 * @returns        object with { newFilePath, newFileName, newMime } if success; else false
 */
export async function convertToPNG(
  filePath: string,
  dirPath: string,
  fileName: string
): Promise<{ newFilePath: string; newFileName: string; newMime: string } | false> {

  try {
    const randomSuffix = randomBytes(10).toString("hex");
    const { name: baseName } = path.parse(fileName);

    const newFileName = `${baseName}_${randomSuffix}.png`;
    const newFilePath = path.join(dirPath, newFileName);

    await sharp(filePath)
      .png()  //possibly set additional options here in future
      .toFile(newFilePath);

    const newMime = "image/png";
    return { newFilePath, newFileName, newMime };
  } catch (err) {
    console.error(`Failed to convert ${fileName} to PNG:`, err);
    return false;
  }
}