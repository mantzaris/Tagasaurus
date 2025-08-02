import * as path from "path";
import { randomBytes } from "crypto";
import { stat, unlink } from 'node:fs/promises';

import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobe from 'ffprobe-static'; //newly added
ffmpeg.setFfmpegPath(ffmpegPath || "");
ffmpeg.setFfprobePath(ffprobe.path);

import { convertAnimatedToGif, convertStillToPng, detectAnimation } from "./image";



const VIDEO_TIMEOUT_MS = 4*6_000_000;//4*100min
const AUDIO_TIMEOUT_MS = 6_000_000; //100min


const allowedVideoMimeTypes = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-matroska'
];

const allowedAudioMimeTypes = [
    'audio/mp3',
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
];

const allowedImageMimeTypes = [
    'image/jpeg',
    'image/jpg',
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
    return allowedVideoMimeTypes.includes(mime);
  }
  
  if (mime.startsWith("audio/")) {
    return allowedAudioMimeTypes.includes(mime);
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
      return await convertImage(mime, filePath, dirPath, fileName);
    }

    if (mime.startsWith("audio/")) {
      return await convertAudio(filePath, dirPath, fileName);
    }

    if (mime.startsWith("video/")) {
      return await convertVideo(filePath, dirPath, fileName);
    }

    return false;
}


export async function convertVideo(
  filePath : string,
  dirPath  : string,
  fileName : string,
  timeoutMs = VIDEO_TIMEOUT_MS         // guard
): Promise<{ newFilePath: string; newFileName: string; newMime: string } | false>
{
  const randomSuffix      = randomBytes(10).toString('hex');
  const { name: baseName} = path.parse(fileName);
  const newFileName       = `${baseName}_${randomSuffix}.mp4`;
  const newFilePath       = path.join(dirPath, newFileName);

  const ok = await new Promise<boolean>((resolve) => {
    const cmd = ffmpeg(filePath)
      /* pick streams explicitly */
      .outputOptions([
        '-map', '0:v:0',           // first video stream
        '-map', '0:a?',            // first audio stream if present
        /* video encoding */
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        /* audio encoding */
        '-c:a', 'aac',
        /* playback / streaming friendly */
        '-movflags', '+faststart'
      ])
      .outputFormat('mp4')
      .on('end', async () => {
        try {
          const { size } = await stat(newFilePath);
          resolve(size > 0);       // success only if bytes written
        } catch {
          resolve(false);
        }
      })
      .on('error', () => resolve(false))
      .save(newFilePath);

    /* -------- safety valve -------- */
    const killer = setTimeout(() => {
      cmd.kill('SIGKILL');
      resolve(false);
    }, timeoutMs);

    cmd.on('end',   () => clearTimeout(killer));
    cmd.on('error', () => clearTimeout(killer));
  });

  if (!ok) { // Remove the 0-byte or partially written output, ignore unlink errors
    try { await unlink(newFilePath); } catch {}
    return false;
  }

  return { newFilePath, newFileName, newMime: 'video/mp4' };
}



export async function convertAudio(
  filePath: string,
  dirPath: string,
  fileName: string,
  timeoutMs = AUDIO_TIMEOUT_MS
): Promise<{ newFilePath: string; newFileName: string; newMime: string } | false> {

  const randomSuffix      = randomBytes(10).toString('hex');
  const { name: baseName} = path.parse(fileName);
  const newFileName       = `${baseName}_${randomSuffix}.mp3`;
  const newFilePath       = path.join(dirPath, newFileName);

  const ok = await new Promise<boolean>((resolve) => {
    const cmd = ffmpeg(filePath)
      .noVideo()                       // strip any accidental video track
      .audioCodec('libmp3lame')        // most ffmpeg-static builds include this
      .audioBitrate('192k')
      .outputFormat('mp3')
      .on('end', async () => {
        try {
          const { size } = await stat(newFilePath);
          resolve(size > 0);
        } catch {
          resolve(false);
        }
      })
      .on('error', () => resolve(false))
      .save(newFilePath);

    /* ---- safety valve ---- */
    const killer = setTimeout(() => {
      cmd.kill('SIGKILL');
      resolve(false);
    }, timeoutMs);

    cmd.on('end',   () => clearTimeout(killer));
    cmd.on('error', () => clearTimeout(killer));
  });

  if (!ok) { // Remove the 0-byte or partially written output, ignore unlink errors
    try { await unlink(newFilePath); } catch {}
    return false;
  }

  return { newFilePath, newFileName, newMime: 'audio/mpeg' };
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
export async function convertImage(
    mime: string,
    filePath: string,
    dirPath: string,
    fileName: string
  ): Promise<{ newFilePath: string; newFileName: string; newMime: string } | false> {
  
    try {
      const randomSuffix = randomBytes(10).toString("hex");
      const { name: baseName } = path.parse(fileName);
  
      const isAnimated = await detectAnimation(filePath, mime);
  
      if (!isAnimated) {
        const newFileName = `${baseName}_${randomSuffix}.png`;
        const newFilePath = path.join(dirPath, newFileName);
      
        const ok = await convertStillToPng(filePath, newFilePath);
      
        if (!ok) {
          return false;
        }
      
        return { newFilePath, newFileName, newMime: 'image/png' };
      } else {
        const newFileName = `${baseName}_${randomSuffix}.gif`;
        const newFilePath = path.join(dirPath, newFileName);
        const gifSuccess = await convertAnimatedToGif(filePath, newFilePath);
        if(!gifSuccess) {
          return false;
        }
        const newMime = "image/gif";
        return { newFilePath, newFileName, newMime };
      }
    } catch (err) {
      console.error(`Failed to convert ${fileName} to PNG or GIF:`, err);
      return false;
    }
}
  

