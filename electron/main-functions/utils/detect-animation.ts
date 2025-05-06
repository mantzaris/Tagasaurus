import { readFile } from 'node:fs/promises';
import isAnimated from '@frsource/is-animated';
import ffmpeg from 'fluent-ffmpeg';

const QUICK_FORMATS = new Set(['image/gif', 'image/webp', 'image/png']); // APNG is just image/png

export async function detectAnimation(filePath: string, mime: string) {
  const buf = await readFile(filePath);
  const resultQuickCheck = isAnimated(buf);
  if (resultQuickCheck || mime === 'image/gif' || mime === 'image/webp' || mime === 'image/png')
    return resultQuickCheck;

  //let ffprobe check if it is actually animated for exotic
  try {
    return await isAnimatedImageFFmpeg(filePath);
  } catch {
    return false;
  }
}
 
async function isAnimatedImageFFmpeg(filePath: string): Promise<boolean> {
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