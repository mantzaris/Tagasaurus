import { readFile, stat } from 'node:fs/promises';
import isAnimated from '@frsource/is-animated';
import ffmpeg from 'fluent-ffmpeg';

const QUICK_ANIMATED_FORMATS = new Set(['image/gif', 'image/webp', 'image/png']); // APNG is just image/png


/**
 * Convert a single-frame image to PNG using FFmpeg.
 * Returns true on success, false on failure / timeout.
 */
export async function convertStillToPng(
  inputPath: string,
  outputPath: string,
  timeoutMs = 15_000
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const cmd = ffmpeg(inputPath)
      // One output frame → PNG
      .outputOptions(['-frames:v', '1'])
      .outputFormat('png')
      .on('end', async () => {
        try {
          const { size } = await stat(outputPath);
          resolve(size > 0);
        } catch {
          resolve(false);
        }
      })
      .on('error', () => resolve(false))
      .save(outputPath);

    /* -------- safety valve -------- */
    const killer = setTimeout(() => {
      cmd.kill('SIGKILL');
      resolve(false);
    }, timeoutMs);

    cmd.on('end',   () => clearTimeout(killer));
    cmd.on('error', () => clearTimeout(killer));
  });
}


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


export async function convertAnimatedToGif(
  inputPath: string,
  outputPath: string,
  timeoutMs = 60_000          // hard kill after 60 s
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const cmd = ffmpeg(inputPath)
      .outputOptions([
        '-an',
        '-filter_complex',
        `[0:v]split[a][b];[a]palettegen=stats_mode=single[p];` +
        `[b][p]paletteuse=dither=bayer:bayer_scale=5`,
        '-loop', '0',
        '-vsync', '0'
      ])
      .on('end', async () => {
        try {
          const { size } = await stat(outputPath);
          resolve(size > 0);    //true / empty file -> false
        } catch {
          resolve(false);         // file missing or unreadable
        }
      })
      .on('error', () => resolve(false))
      .save(outputPath);

    const killer = setTimeout(() => {
      cmd.kill('SIGKILL');
      resolve(false);
    }, timeoutMs);

    cmd.on('end',   () => clearTimeout(killer));
    cmd.on('error', () => clearTimeout(killer));
  });
}


// export function convertAnimatedToGif(
//   inputPath: string,
//   outputPath: string
// ): Promise<void> {
//   return new Promise((resolve, reject) => {
//     ffmpeg(inputPath)
//       .outputOptions([
//         '-an',
//         '-filter_complex',
//         '[0:v] split [a][b];' +
//           '[a] palettegen=stats_mode=single [p];' +
//           '[b][p] paletteuse=dither=bayer:bayer_scale=5',
//         '-loop 0'
//       ])
//       .output(outputPath)
//       .on('end', () => resolve())
//       .on('error', (err) => reject(err))
//       .run();
//   });
// }