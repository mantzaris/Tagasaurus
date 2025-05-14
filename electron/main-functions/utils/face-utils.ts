import * as ort   from 'onnxruntime-node';
import nudged     from 'nudged';
import * as path  from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import * as fs    from 'fs/promises';


import { Readable } from 'stream';
import streamifier from 'streamifier';

import { GifReader } from 'omggif';
import WebP from 'node-webpmux';
import { PNG } from 'pngjs';

import { detectAnimation } from './image';


ffmpeg.setFfmpegPath(ffmpegPath || "");
//TODO: not thread safe, make the onnx file uses singletons or put on worker threads to be safe

const MODELS_DIR  = path.join(__dirname, '..', '..', '..', '..', 'models', 'buffalo_l');
// const OUT_DIR    = '/home/resort/Pictures/temp1';           // make sure it exists!

const MARGIN = 0.18;

let scrfdSess: ort.InferenceSession;
let arcSess  : ort.InferenceSession;
let setupPromise: Promise<void> | null = null;

export interface FaceDet { score:number; box:number[]; kps:number[]; }
interface Point { x: number; y: number; }

const CANONICAL_112: Point[] = [
  {x:38.2946, y:51.6963},
  {x:73.5318, y:51.5014},
  {x:56.0252, y:71.7366},
  {x:41.5493, y:92.3655},
  {x:70.7299, y:92.2041}
];

const SIGM = (x:number) => 1/(1+Math.exp(-x));
const STRIDES = [8, 16, 32];


export async function faceSetupOnce(): Promise<void> {
    if (scrfdSess && arcSess) return;
    if (!setupPromise) {
      setupPromise = (async () => {
        scrfdSess = await ort.InferenceSession.create(path.join(MODELS_DIR,'det_10g.onnx'));
        arcSess   = await ort.InferenceSession.create(path.join(MODELS_DIR,'w600k_r50.onnx'));
      })();
    }
    await setupPromise;
}


function nonMaxSup(faces: FaceDet[], thr = 0.3): FaceDet[] {
    const iou = (a:number[], b:number[]) => {
      const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]);
      const x2 = Math.min(a[2], b[2]), y2 = Math.min(a[3], b[3]);
      const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
      const ua = (a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - inter;
      return inter / ua;
    };
    faces.sort((a,b)=>b.score-a.score);
    const out: FaceDet[] = [];
    faces.forEach(f => { if (out.every(o => iou(f.box,o.box) < thr)) out.push(f); });
    return out;
}
  
// parse SCRFD outputs exactly like the renderer version
function getFaces(
    det: Record<string, any>,
    sess: ort.InferenceSession,
    scale: number,
    dx: number,
    dy: number,
    side: number,
    confTh = 0.55,
  ): FaceDet[] {
  
    const faces: FaceDet[] = [];
  
    for (let sIdx = 0; sIdx < STRIDES.length; ++sIdx) {
      const stride = STRIDES[sIdx];
      const scores = det[sess.outputNames[sIdx]   ].data as Float32Array;
      const deltas = det[sess.outputNames[sIdx+3] ].data as Float32Array;
      const kraw   = det[sess.outputNames[sIdx+6] ].data as Float32Array;
  
      const g = side / stride;    // grid size along x or y
  
      for (let y = 0; y < g; ++y)
        for (let x = 0; x < g; ++x)
          for (let a = 0; a < 2; ++a) {
            const idx = (y*g + x)*2 + a;
            const p   = SIGM(scores[idx]);
            if (p < confTh) continue;
  
            const cx = (x+0)*stride, cy = (y+0)*stride;
            const o4  = idx*4,  o10 = idx*10;
  
            const l = deltas[o4  ]*stride,
                  t = deltas[o4+1]*stride,
                  r = deltas[o4+2]*stride,
                  b = deltas[o4+3]*stride;
  
            const box = [
              (cx-l-dx)/scale, (cy-t-dy)/scale,
              (cx+r-dx)/scale, (cy+b-dy)/scale
            ];
  
            const kps = new Array<number>(10);
            for (let k=0;k<5;++k) {
              kps[2*k]   = (cx + kraw[o10+2*k  ]*stride - dx)/scale;
              kps[2*k+1] = (cy + kraw[o10+2*k+1]*stride - dy)/scale;
            }
            faces.push({score:p, box, kps});
          }
    }
    return nonMaxSup(faces);
}
  

async function preprocessNode(data: Buffer | Readable) {
    const SIDE = 640;
  
    const { w, h, rot } = await ffprobeDims(data);

    const scale = Math.min(SIDE / w, SIDE / h);
    const nw    = Math.round(w * scale);
    const nh    = Math.round(h * scale);
    
    // pass rotation (0, 90, 180, 270) to the helper
    const paddedRGB = await ffmpegScalePadRaw(data, nw, nh, SIDE, rot);  
    
    //build BGR Float32 CHW tensor with InsightFace scaling    
  
    const size  = SIDE*SIDE;
    const f32   = new Float32Array(3*size);
  
    for (let i=0; i<size; ++i) {
      const r = paddedRGB[i*3    ];
      const g = paddedRGB[i*3 +1 ];
      const b = paddedRGB[i*3 +2 ];
      f32[i]          = (b - 127.5)/128;    // B
      f32[i +   size] = (g - 127.5)/128;    // G
      f32[i + 2*size] = (r - 127.5)/128;    // R
    }
  
    const tensor = new ort.Tensor('float32', f32, [1,3,SIDE,SIDE]);
    // return { tensor, scale, dx:0, dy:0, side:SIDE, width: w, height: h };

    const rw = (rot % 180 === 90) ? h : w;
    const rh = (rot % 180 === 90) ? w : h;
    return { tensor, scale, dx:0, dy:0, side:SIDE, width: rw, height: rh };
}




/**
 * Scale-pad a single encoded frame (image | video-frame) to SIDE×SIDE
 * and return raw rgb24 bytes.
 *
 * @param data   Buffer with the encoded frame **or** a pre-made Readable stream
 * @param nw     target width  (pre-computed to keep math outside)
 * @param nh     target height (pre-computed)
 * @param SIDE   side length of the padded square (default = 640)
 * @param rotDeg CW rotation in degrees from EXIF / ffprobe (0 | 90 | 180 | 270)
 */
async function ffmpegScalePadRaw(
  data   : Buffer | Readable,
  nw     : number,
  nh     : number,
  SIDE   = 640,
  rotDeg : number = 0
): Promise<Buffer> {

  // Convert Buffer → Readable; leave Readable untouched
  const inStream = Buffer.isBuffer(data)
    ? streamifier.createReadStream(data)
    : data;

  // Build the filter chain (rotation → resize → pad → rgb24)
  const filters: string[] = [];
  switch (rotDeg % 360) {
    case 90:  filters.push('transpose=1');              break;
    case 180: filters.push('transpose=1,transpose=1');  break;
    case 270: filters.push('transpose=2');              break;
  }
  filters.push(
    `scale=${nw}:${nh}:flags=lanczos+accurate_rnd+full_chroma_inp`,
    `pad=${SIDE}:${SIDE}:0:0:black`,
    'format=rgb24'
  );
  const vf = filters.join(',');

  // Pipe stdin → FFmpeg → rawvideo Buffer
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    ffmpeg(inStream)
      .inputOptions('-f', 'image2pipe')          // stdin = single image
      .outputOptions(
        '-vf',       vf,
        '-vframes',  '1',
        '-f',        'rawvideo',
        '-pix_fmt',  'rgb24'
      )
      .on('error', reject)
      .on('end', () => resolve(Buffer.concat(chunks)))
      .pipe()
      .on('data', chunk => chunks.push(chunk));
  });
}



//PUBLIC entry function for embeddings
export async function processFacesOnImageData(data: Buffer | Readable): Promise<Float32Array[]> {

    await faceSetupOnce();

    const { tensor, scale, dx, dy, side, width, height } =
            await preprocessNode(data);

    const feeds: Record<string, ort.Tensor> = {};
    feeds[scrfdSess.inputNames[0]] = tensor;
    const detOut = await scrfdSess.run(feeds);

    const faces = getFaces(detOut, scrfdSess, scale, dx, dy, side);

    if (faces.length === 0) return []; //no faces return

    
    const embeddings: Float32Array[] = [];
    let idx = 0;

    for (const face of faces) {
        
        const { boxBigger, kpsBigger } =
                scaleFaceBox({ width, height }, face.box, face.kps, MARGIN);


        const [x1, y1, x2, y2] = boxBigger;
        const side   = Math.max(x2 - x1, y2 - y1);
        const cx     = (x1 + x2) / 2;
        const cy     = (y1 + y2) / 2;
        let cropLeft = cx - side / 2;
        let cropTop  = cy - side / 2;
        
        cropLeft = Math.max(0, cropLeft);
        cropTop  = Math.max(0, cropTop);
        let cropSide = Math.min(side, width - cropLeft, height - cropTop);

        const leftInt  = Math.floor(cropLeft);
        const topInt   = Math.floor(cropTop);
        const sideInt  = Math.ceil(cropSide);   

        const kpsLocal = kpsBigger.map((v,i) =>
            i % 2 === 0 ? v - leftInt : v - topInt);

        // await ffmpegCrop112(
        //      filePath,
        //     path.join(OUT_DIR, `${fileStem}_face${idx}.png`),
        //      leftInt,
        //      topInt,
        //      sideInt
        //    );        
        
        // const raw112    = await ffmpegCrop112Raw(filePath, leftInt, topInt, sideInt);
        const raw112 = await ffmpegAligned112Raw(data, kpsLocal);
        const tensor112 = rgb24ToTensor112(raw112);
        // console.log(`face ${idx} tensor dims →`, tensor112.dims);  // should log [1,3,112,112]

        const embOut = await arcSess!.run({ [arcSess!.inputNames[0]]: tensor112 });
        const emb    = embOut[arcSess!.outputNames[0]].data as Float32Array;
        l2Normalize(emb);
        embeddings.push(emb);

        // console.log(`face ${idx} emb[0..4] →`, Array.from(emb.slice(0,5)));
        // const norm = Math.sqrt(emb.reduce((s,x) => s + x*x, 0));
        // console.log(`face ${idx} L2 →`, norm.toFixed(3));
        ++idx;
    }

    return embeddings;     
}
  


export function scaleFaceBox(
    img: { width:number; height:number },
    box: number[],
    kps: number[],
    margin = 0.15
) {
    let [x1,y1,x2,y2] = box;
    const w = x2 - x1, h = y2 - y1;

    x1 = Math.max(0, x1 - w*margin);
    y1 = Math.max(0, y1 - h*margin);
    x2 = Math.min(img.width , x2 + w*margin);
    y2 = Math.min(img.height, y2 + h*margin);

    const kNew = kps.slice();
    for (let i=0;i<5;++i){
        kNew[2*i]   = Math.min(Math.max(kNew[2*i]  , x1), x2);
        kNew[2*i+1] = Math.min(Math.max(kNew[2*i+1], y1), y2);
    }
    return { boxBigger:[x1,y1,x2,y2], kpsBigger:kNew };
}


function rgb24ToTensor112(buf: Buffer): ort.Tensor {
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

function l2Normalize(v: Float32Array) {
  let sum = 0;
  for (let i = 0; i < v.length; ++i) sum += v[i] * v[i];
  const inv = 1 / Math.sqrt(sum || 1);
  for (let i = 0; i < v.length; ++i) v[i] *= inv;
}



//--------------------------

/**
 * Build an FFmpeg perspective filter that maps the 112×112
 * canonical template onto the source image via 5-point similarity.
 */
function ffmpegAligned112Raw(
  data: Buffer | Readable,
  kps : number[]          // 10 numbers, full-image coords
): Promise<Buffer> {

  //landmarks detected on current face ---------------------
  const srcPts = [0,2,4,6,8].map(i => ({x:kps[i], y:kps[i+1]}));

  //similarity transform using nudged ----------------------
  const tfm = nudged.estimators.TSR(srcPts, CANONICAL_112);      // src → dst
  const M = nudged.transform.toMatrix(tfm);               // a,b,c,d,e,f

  //convert to 3×3 matrix and invert (FFmpeg needs dst→src)
  const A = [ [M.a,M.c,M.e],
              [M.b,M.d,M.f],
              [0 ,  0 , 1 ] ];
  const inv = mathInverse(A);  // use a tiny 3×3 inverse helper

  //sample coordinates of output corners back in input img
  const map = (x:number,y:number) => {
    const u = inv[0][0]*x + inv[0][1]*y + inv[0][2];
    const v = inv[1][0]*x + inv[1][1]*y + inv[1][2];
    const w = inv[2][0]*x + inv[2][1]*y + inv[2][2];
    return [u/w, v/w];
  };
  const [x0,y0] = map(0,0);
  const [x1,y1] = map(111,0);
  const [x2,y2] = map(111,111);
  const [x3,y3] = map(0,111);

  const vf = `perspective=` +
             `x0=${x0}:y0=${y0}:x1=${x1}:y1=${y1}:` +
             `x2=${x2}:y2=${y2}:x3=${x3}:y3=${y3},` +
             `scale=112:112:flags=lanczos`;


  const inStream = Buffer.isBuffer(data)
    ? Readable.from([data])      // one chunk, back-pressure friendly
    : data;


  return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];

      ffmpeg(inStream)
        .inputOptions('-f', 'image2pipe')
        .outputOptions('-vf', vf,
                      '-frames:v', '1',
                      '-f', 'rawvideo',
                      '-pix_fmt', 'rgb24')
        .on('error', reject)
        .on('end', () => resolve(Buffer.concat(chunks)))
        .pipe()
        .on('data', c => chunks.push(c));
    });
}

// very small 3×3 inverse; paste near your helpers
function mathInverse(m:number[][]){
  const [a,b,c] = m[0], [d,e,f] = m[1], [g,h,i] = m[2];
  const det = a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);
  const invDet = 1/det;
  return [
    [(e*i-f*h)*invDet, (c*h-b*i)*invDet, (b*f-c*e)*invDet],
    [(f*g-d*i)*invDet, (a*i-c*g)*invDet, (c*d-a*f)*invDet],
    [(d*h-e*g)*invDet, (b*g-a*h)*invDet, (a*e-b*d)*invDet]
  ];
}



/**
 * Extract width, height and EXIF/video‐rotate from an **in-memory frame**.
 *
 * @param src  Buffer (encoded frame) **or** pre-built Readable stream
 * @returns    { w, h, rot } where rot ∈ { 0, 90, 180, 270 }
 */
export function ffprobeDims(
  src: Buffer | Readable
): Promise<{ w: number; h: number; rot: number }> {

  const isBuf   = Buffer.isBuffer(src);
  const inStream = isBuf ? Readable.from([src]) : src;

  const isWebP  = isBuf &&
                  src.toString('ascii', 0, 4) === 'RIFF' &&
                  src.toString('ascii', 8, 12) === 'WEBP';

  const inputOpts =
    isBuf ? ['-f', isWebP ? 'webp_pipe' : 'image2pipe'] : [];

  return new Promise((resolve, reject) => {
    ffmpeg(inStream)
      .inputOptions(...inputOpts)
      .ffprobe((err, meta) => {
        if (!err) {
          const s = meta.streams.find(
            v => v.codec_type === 'video' || v.codec_type === 'image'
          );
          if (s?.width && s?.height)
            return resolve({ w: s.width, h: s.height, rot: +(s.tags?.rotate ?? 0) });
        }

        /* -------- FFprobe failed: try manual WebP header -------------- */
        if (isWebP) {
          const dims = webpDims(src as Buffer);
          if (dims) return resolve({ ...dims, rot: 0 });
        }
        reject(err ?? new Error('ffprobe: no dimensions'));
      });
  });
}




//MAIN ENTRY POINT
export async function processFacesOnImage(
  filePath: string, inferredFileType: string
): Promise<Float32Array[]> {

  if (inferredFileType.startsWith('image/')) {
    const animated = await detectAnimation(filePath, inferredFileType);

    if (animated) {
      const info = await analyseAnimated(filePath, inferredFileType);
      if (info) {
        const { frames } = info;          // indices chosen by chooseFrames
        const allEmbeddings: Float32Array[] = [];

        for (const idx of frames) {
          let frameBuf: Buffer;

          if (inferredFileType === 'image/gif') {
            frameBuf = await extractGifFrame(filePath, idx);
          } else if (inferredFileType === 'image/webp') {
            // frameBuf = await extractWebPFrame(filePath, idx);
            frameBuf = await extractWebPFrame(filePath, idx);   // now always FFmpeg
          } else {
            // APNG or something else, FFmpeg fallback
            frameBuf = await extractFrameViaFFmpeg(filePath, idx);
          }

          const embForFrame = await processFacesOnImageData(frameBuf);
          allEmbeddings.push(...embForFrame);
        }

        console.log(
          `${path.basename(filePath)} → ${allEmbeddings.length} face(s) (across ${
            frames.length
          } sampled frame${frames.length > 1 ? 's' : ''})`
        );
        return allEmbeddings;             // TODO: aggregate in conservative way
      }

      //when analyseAnimated returns false (e.g. unsupported mime), FALL THROUGH to default below
    }
  }

  if (inferredFileType.startsWith('video/')) {
    const dur = await videoDurationSec(filePath);          // e.g. 123.7 s
    const stamps = chooseTimes(dur, 1);                    // 0,1,2,… (max 150)
    const allEmbeddings: Float32Array[] = [];
  
    for (const t of stamps) {
      try {
        const frameBuf = await extractVideoFrame(filePath, t);
        const embThis  = await processFacesOnImageData(frameBuf);
        allEmbeddings.push(...embThis);
      } catch (e) {
        console.warn(`frame @${t}s failed:`, e);
      }
    }
  
    console.log(
      `${path.basename(filePath)} → ${allEmbeddings.length} face(s) (from ${
        stamps.length
      } sampled second${stamps.length > 1 ? 's' : ''})`
    );
    return allEmbeddings;  // TODO: aggregate in conservative way later: cluster/dedup if desired
  }


  // fallback
  const frameBuf = await fs.readFile(filePath);   // throws if file missing

  /* full detection + embedding pipeline */
  const embeddings = await processFacesOnImageData(frameBuf);

  /* minimal console output */
  console.log(
    `${path.basename(filePath)} → detected ${embeddings.length} face(s)`
  );
  embeddings.forEach((emb, i) =>
    console.log(`  face ${i}: [${Array.from(emb.slice(0, 5)).join(', ')}…]`)
  );

  return embeddings;
}


//VIDEO STUFF
async function videoDurationSec(file: string): Promise<number> {
  return new Promise((res, rej) => {
    ffmpeg.ffprobe(file, (err, meta) => {
      if (err) return rej(err);
      const secs = meta.format.duration ?? 0;
      res(secs);
    });
  });
}

async function extractVideoFrame(file: string, tSec: number): Promise<Buffer> {
  return new Promise<Buffer>((res, rej) => {
    const chunks: Buffer[] = [];
    ffmpeg(file)
      .seekInput(tSec)                      // -ss before input read
      .outputOptions(
        '-frames:v', '1',                   // grab 1 frame
        '-f',        'image2pipe',
        '-vcodec',   'png'                  // lossless
      )
      .output('pipe:1')
      .on('error', rej)
      .on('end', () => res(Buffer.concat(chunks)))
      .pipe()
      .on('data', c => chunks.push(c));
  });
}

function chooseTimes(duration: number, stepSec = 1, cap = 150): number[] {
  const wanted = Math.min(cap, Math.ceil(duration / stepSec));
  const times: number[] = [];
  for (let i = 0; i < wanted; ++i) times.push(i * stepSec);
  return times;
}


//--------------------------
//GIF STUFF
export async function analyseAnimated(file: string, mime: string) {
  let total = 1;

  if (mime === 'image/gif') {
    total = await countGifFrames(file);
  } else if (mime === 'image/webp') {
    total = await countWebPFrames(file);
  } else {
    return false;
  }

  const picks = chooseFrames(total);
  console.log(`animated: ${total} frames → sample`, picks);
  return { total, frames: picks };
}

function chooseFrames(total: number): number[] {
  const maxFrames = 150;
  const wanted    = Math.min(maxFrames, Math.max(1, Math.ceil(total / 20)));

  const step = total / wanted;        // float
  const picks: number[] = [];
  for (let i = 0; i < wanted; ++i) picks.push(Math.floor(i * step));

  // Ensure last frame is included
  if (picks[picks.length - 1] !== total - 1) picks.push(total - 1);

  return picks;
}

export async function countWebPFrames(path: string) {
  const img = new WebP.Image();
  await img.load(path);
  return img.frames.length;                       // 1 is not animated
}

export async function countGifFrames(path: string) {
  const buf = await fs.readFile(path);
  const reader = new GifReader(buf);
  return reader.numFrames();                 // integer frame count
}


async function extractGifFrame(file: string, frameIdx: number): Promise<Buffer> {
  const buf   = await fs.readFile(file);
  const gif   = new GifReader(buf);
  const frame = Buffer.allocUnsafe(gif.width * gif.height * 4);   // RGBA
  gif.decodeAndBlitFrameRGBA(frameIdx, frame);
  // Convert RGBA → PNG in-memory so ffmpegScalePadRaw can read it
  return encodePng(frame, gif.width, gif.height);                 // small helper
}


/**
 * Convert an RGBA Buffer to a PNG Buffer (no file-system writes).
 *
 * @param rgba   Raw RGBA pixels, length = width * height * 4
 * @param width
 * @param height
 */
export function encodePng(
  rgba  : Buffer,
  width : number,
  height: number
): Buffer {
  // pngjs wants a PNG instance with .data = RGBA buffer
  const png = new PNG({ width, height });
  rgba.copy(png.data);               // no per-pixel loop, just one copy
  return PNG.sync.write(png);        // returns a Node Buffer
}

// async function extractWebPFrame(file: string, frameIdx: number): Promise<Buffer> {
//   const img = new WebP.Image();
//   await img.load(file);
//   const frame = await img.getFrame(frameIdx);
//   return encodePng(Buffer.from(frame.bitmap), frame.width, frame.height);
// }
async function extractWebPFrame(
  file   : string,
  frameIdx: number
): Promise<Buffer> {
  return extractFrameViaFFmpeg(file, frameIdx);   // reuse the generic helper
}

// fallback for APNG / exotic formats
async function extractFrameViaFFmpeg(
  file: string,
  frameIdx: number
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    ffmpeg(file)
      .outputOptions(
        '-vf', `select='gte(n\\,${frameIdx})',setpts=PTS-STARTPTS`,
        '-frames:v', '1',
        '-f', 'image2pipe',
        '-vcodec', 'png'
      )
      .output('pipe:1')
      .on('error', reject)
      .on('end', () => resolve(Buffer.concat(chunks)))
      .pipe()
      .on('data', c => chunks.push(c));
  });
}

function webpDims(buf: Buffer) {
  // RIFF….WEBP
  if (buf.toString('ascii', 0, 4) !== 'RIFF' ||
      buf.toString('ascii', 8, 12) !== 'WEBP')
    return null;

  // VP8  (lossy) : starts at byte 20, little-endian 16-bit width/height −1
  if (buf.toString('ascii', 12, 15) === 'VP8') {
    const w = buf.readUInt16LE(26) & 0x3FFF;
    const h = buf.readUInt16LE(28) & 0x3FFF;
    return { w, h };
  }

  // VP8L (lossless) or VP8X (extended) – quick parse
  if (buf.toString('ascii', 12, 15) === 'VP8L') {
    const b0 = buf[21];
    const b1 = buf[22];
    const b2 = buf[23];
    const b3 = buf[24];
    const w = 1 + (((b1 & 0x3F) << 8) | b0);
    const h = 1 + (((b3 & 0xF)  << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6));
    return { w, h };
  }
  return null;
}