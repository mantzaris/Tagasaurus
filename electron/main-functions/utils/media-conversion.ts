import * as path from "path";
import { randomBytes } from "crypto";

import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

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
      return await convertImage(filePath,dirPath,fileName);
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
    filePath: string,
    dirPath: string,
    fileName: string
  ): Promise<{ newFilePath: string; newFileName: string; newMime: string } | false> {
  
    try {
      const randomSuffix = randomBytes(10).toString("hex");
      const { name: baseName } = path.parse(fileName);
  
      const isAnimated = await detectAnimation(filePath);
  
      if(!isAnimated) {
        const newFileName = `${baseName}_${randomSuffix}.png`;
        const newFilePath = path.join(dirPath, newFileName);
        
        try {
          await sharp(filePath).png().toFile(newFilePath);
        } catch (sharpErr) {
          console.warn("Sharp failed for static image, trying ffmpeg fallback", sharpErr);
          try {
            await convertToPngViaFfmpeg(filePath, newFilePath);
          } catch (ffErr) {
            console.error("FFmpeg fallback also failed:", ffErr);
            return false;
          }
        }
        
        const newMime = "image/png";
        return { newFilePath, newFileName, newMime };
      } else {
        const newFileName = `${baseName}_${randomSuffix}.gif`;
        const newFilePath = path.join(dirPath, newFileName);
        await convertAnimatedToGif(filePath, newFilePath);
        const newMime = "image/gif";
        return { newFilePath, newFileName, newMime };
      }
    } catch (err) {
      console.error(`Failed to convert ${fileName} to PNG or GIF:`, err);
      return false;
    }
}
  
/** ffmpeg to convert a static image to PNG */
async function convertToPngViaFfmpeg(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputFormat('png')
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * convert animated image to animated GIF with ffmpeg
 */
export function convertAnimatedToGif(
    inputPath: string,
    outputPath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-an',
          '-filter_complex',
          '[0:v] split [a][b];' +
            '[a] palettegen=stats_mode=single [p];' +
            '[b][p] paletteuse=dither=bayer:bayer_scale=5',
          '-loop 0'
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
}
  
async function detectAnimation(filePath: string) {
    //first attempt with sharp, faster but less reliable, can produce false negatives
    try {
      const metadata = await sharp(filePath).metadata();
      return (metadata.pages ?? 1) > 1;
    } catch (sharpError) {
      console.warn("sharp error reading metadata, falling back to ffprobe:", sharpError);
    }
  
    //then a fallback to ffprobe, slower, but more reliable, has to spawn process
    try {
      return await isAnimatedImageFFmpeg(filePath);
    } catch (ffmpegError) {
      console.error("Failed to run ffprobe:", ffmpegError);
      return false;
    }
}
  
export async function isAnimatedImageFFmpeg(filePath: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          return reject(err);
        }
  
        let totalFrames = 0;
        metadata.streams.forEach((stream) => {
          if (stream.nb_frames) {
            totalFrames += parseInt(stream.nb_frames, 10);
          }
        });
        //totalFrames > 1, treat it as animated
        resolve(totalFrames > 1);
      });
    });
}
  
  
  //reliable but slower needing ffmpeg each time
  // async function detectAnimation(filePath: string): Promise<boolean> {
  //   try {
  //     return await isAnimatedImageFFmpeg(filePath);
  //   } catch (err) {
  //     console.error("Failed to run ffprobe:", err);
  //     return false;
  //   }
  // }
  
  // export async function isAnimatedImageFFmpeg(filePath: string): Promise<boolean> {
  //   return new Promise((resolve, reject) => {
  //     ffmpeg.ffprobe(filePath, (err, metadata) => {
  //       if (err) {
  //         return reject(err);
  //       }
  
  //       let totalFrames = 0;
  //       metadata.streams.forEach((stream) => {
  //         if (stream.nb_frames) {
  //           totalFrames += parseInt(stream.nb_frames, 10);
  //         }
  //       });
  
  //       // If totalFrames > 1 => definitely animated
  //       if (totalFrames > 1) {
  //         return resolve(true);
  //       }
  
  //       // Otherwise, do a quick fallback check for "video" streams with durations
  //       const videoStreams = metadata.streams.filter(
  //         (s) => s.codec_type === 'video' || s.codec_type === 'data'
  //       );
  
  //       const mightBeAnimated = videoStreams.some((stream) => {
  //         if (
  //           stream.duration &&
  //           !['mjpeg', 'png', 'bmp', 'tiff'].includes(stream.codec_name)
  //         ) {
  //           return true;
  //         }
  //         return false;
  //       });
  
  //       resolve(mightBeAnimated);
  //     });
  //   });
  // }
  


