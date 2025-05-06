import * as path from "path";
import { randomBytes } from "crypto";

import ffmpeg, { FfprobeData } from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { convertAnimatedToGif, convertStillToPng, detectAnimation } from "./image";

ffmpeg.setFfmpegPath(ffmpegPath || "");


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


/**
 * convert any input video to a standard MP4 (H.264 + AAC)
 *
 * @param filePath  path to input video
 * @param dirPath   directory to place the converted file
 * @param fileName  original file name (e.g. "movie.avi")
 * @returns         { newFilePath, newFileName, newMime } if success; else false
 */
export async function convertVideo(
  filePath: string,
  dirPath: string,
  fileName: string
): Promise<{ newFilePath: string; newFileName: string; newMime: string } | false> {
  try {
    const randomSuffix = randomBytes(10).toString("hex");
    const { name: baseName } = path.parse(fileName);

    const newFileName = `${baseName}_${randomSuffix}.mp4`;
    const newFilePath = path.join(dirPath, newFileName);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(filePath)
        .videoCodec("libx264")
        .audioCodec("aac")
        .outputOptions([
          "-movflags", "+faststart",
          "-preset", "medium",
          "-crf", "23"
        ])
        .format("mp4")
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .save(newFilePath);
    });

    const newMime = "video/mp4";
    return { newFilePath, newFileName, newMime };

  } catch (err) {
    console.error(`Failed to convert ${fileName} to MP4:`, err);
    return false;
  }
}


export async function convertAudio(
  filePath: string,
  dirPath: string,
  fileName: string
): Promise<{ newFilePath: string; newFileName: string; newMime: string } | false> {
  try {
    const randomSuffix = randomBytes(10).toString("hex");
    const { name: baseName } = path.parse(fileName);

    const newFileName = `${baseName}_${randomSuffix}.mp3`;
    const newFilePath = path.join(dirPath, newFileName);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(filePath)
        .audioBitrate('192k') //set audio bitrate, 192k decent default
        .audioCodec('libmp3lame') //libmp3lame (most ffmpeg distributions have this)
        .format('mp3') //container/format mp3
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(newFilePath);
    });

    //if successful return the new path/name with MP3 mime
    const newMime = "audio/mpeg";
    return { newFilePath, newFileName, newMime };

  } catch (err) {
    console.error(`Failed to convert ${fileName} to MP3:`, err);
    return false;
  }
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
  
      const isAnimated = await detectAnimation(mime, filePath);
  
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
  






  
  
  


