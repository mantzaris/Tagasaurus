import { readFile, stat } from 'node:fs/promises';
import isAnimated from '@frsource/is-animated';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";
import { once, Readable } from 'node:stream';
import * as ort   from 'onnxruntime-node';


ffmpeg.setFfmpegPath(ffmpegPath || "");

/**
 * Convert a **still** image (JPEG, WebP, AVIF, …) to PNG using Sharp.
 *
 * @param inputPath  full path of the source file
 * @param outputPath full path of the PNG to write
 * @param timeoutMs  failsafe timeout (default 15 s)
 * @returns          true  → PNG written and > 0 bytes  
 *                   false → any error or timeout
 */
export async function convertStillToPng(
  inputPath : string,
  outputPath: string,
  timeoutMs = 15_000,
): Promise<boolean> {

  let killer: NodeJS.Timeout | null = null;

  /* ---- 1. start the async sharp job ------------------------------ */
  const convert = (async (): Promise<boolean> => {
    try {
      console.log(`[Sharp] ➜ converting "${path.basename(inputPath)}"`);

      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      await sharp(inputPath)
        .rotate()            // honour EXIF orientation
        .png()               // encode PNG
        .toFile(outputPath);

      const { size } = await fs.stat(outputPath);
      console.log(`[Sharp] ✔ wrote ${size.toLocaleString()} bytes → ${path.basename(outputPath)}`);
      return size > 0;

    } catch (err) {
      console.error(`[Sharp] ✖ ${path.basename(inputPath)} → ${(err as Error).message}`);
      return false;

    } finally {
      if (killer) clearTimeout(killer);
    }
  })();

  /* ---- 2. timeout guard ------------------------------------------ */
  const timeout = new Promise<boolean>(res => {
    killer = setTimeout(() => {
      console.warn(`[Sharp] ⚠ timeout after ${timeoutMs} ms (${path.basename(inputPath)})`);
      res(false);
    }, timeoutMs);
  });

  /* ---- 3. whichever finishes first ------------------------------- */
  return Promise.race([convert, timeout]);
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


async function toBuffer(src: Buffer | Readable): Promise<Buffer> {
  if (Buffer.isBuffer(src)) return src;
  const chunks: Buffer[] = [];
  src.on('data', (c: Buffer) => chunks.push(c));
  await once(src, 'end');
  return Buffer.concat(chunks);
}

export async function saveThumbs(raw: Buffer | Readable, suff = 0) {
  const buf = Buffer.isBuffer(raw) ? raw : await toBuffer(raw);
  await sharp(buf, {
    raw: { width: 112, height: 112, channels: 3 },
  })
  .png()
  .toFile(`/home/resort/Downloads/tempVids/face${suff}.png`);
}


//TODO: still need this?
export async function savePngRaw(
  rgb: Buffer | Uint8Array,
  w: number,
  h: number,
  tag: string,
) {
  await sharp(rgb as Buffer, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toFile(`/home/resort/Downloads/tempVids/${tag}.png`);
}




export function rgb24ToTensor112(buf: Buffer): ort.Tensor {
  const size = 112 * 112;
  const f32  = new Float32Array(3 * size);
  for (let i = 0; i < size; ++i) {
    const r = buf[i*3    ];
    const g = buf[i*3 + 1];
    const b = buf[i*3 + 2];
    f32[i]          = (b - 127.5) / 128;   // B
    f32[i +   size] = (g - 127.5) / 128;   // G
    f32[i + 2*size] = (r - 127.5) / 128;   // R
  }
  return new ort.Tensor('float32', f32, [1, 3, 112, 112]);
}


export async function saveRawRGB24AsPng(
  raw    : Buffer,
  width  : number,
  height : number,
  out    : string,
): Promise<void> {
  const stream = Readable.from([raw]);

  return new Promise((res, rej) => {
    ffmpeg(stream)
      .inputFormat('rawvideo')
      .inputOptions([
        '-pix_fmt rgb24',
        `-s ${width}x${height}`,   // short form of -video_size
      ])
      .outputOptions([
        '-vcodec png',            // choose the PNG encoder
        '-frames:v 1',            // only one frame
        '-y',                     // overwrite existing file
      ])
      .output(out)
      .on('end',  () => res())
      .on('error',rej)
      .run();
  });
}


export function guessCodec(buf: Buffer): 'mjpeg' | 'png' {
  // PNG  89 50 4E 47 0D 0A 1A 0A
  if (buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a') return 'png';
  // JPEG FF D8
  return 'mjpeg';
}
// export function guessCodec(buf: Buffer): 'mjpeg' | 'png' {
//   if (buf.slice(0, 8).toString('ascii') === '\x89PNG\r\n\x1a\n') return 'png';
//   return 'mjpeg';                      // default: most JPEGs start FF D8
// }