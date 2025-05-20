import * as path  from 'path';
import * as fs    from 'fs/promises';
import { Readable } from 'stream';

import * as ort   from 'onnxruntime-node';

import sharp      from 'sharp';//TODO: image-js fo no Libvips dependency
import nudged     from 'nudged';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { FaceDet } from '../../types/face';
import { l2Normalize, mathInverse, nonMaxSup, saveRawRGB24AsPng, scaleFaceBox, SIGM } from './face';

ffmpeg.setFfmpegPath(ffmpegPath || "");
//TODO: not thread safe, make the onnx file uses singletons or put on worker threads to be safe

const MODELS_DIR  = path.join(__dirname, '..', '..', '..', '..', 'models', 'buffalo_l');

const DEBUG = true;
const OUT_DIR = '/home/resort/Pictures/temp'; // make sure it exists!

const MARGIN = 0.3; //for the face outline rang is 0.2 - 0.35

let scrfdSess: ort.InferenceSession;
let arcSess  : ort.InferenceSession;
let setupPromise: Promise<void> | null = null;



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



  
//parse SCRFD outputs 'Bounding boxes'
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

//sharp-based preprocessing   -> 640×640 Float32 CHW tensor
async function preprocessNode(filePath: string) {
    const SIDE = 640;
  
    const imgSharp = sharp(filePath).rotate(); //TODO: no sharp              // EXIF-aware
    const meta      = await imgSharp.metadata();
    if (!meta.width || !meta.height) throw new Error('Cannot read image dims');
  
    const scale = Math.min(SIDE/meta.width, SIDE/meta.height);
    const nw    = Math.round(meta.width  * scale);
    const nh    = Math.round(meta.height * scale);
  
    const paddedRGB = await ffmpegScalePadRaw(filePath, nw, nh, SIDE);
  
    /* ----------------------------------------------------- */
    /* build BGR Float32 CHW tensor with InsightFace scaling */
    /* ----------------------------------------------------- */
  
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
    return { tensor, scale, dx:0, dy:0, side:SIDE, width: meta.width, height: meta.height };
}


/**
 * Produce a 640 × 640 RGB24 buffer with letter-boxing
 */
function ffmpegScalePadRaw(
  file   : string,
  nw     : number,
  nh     : number,
  SIDE   = 640
): Promise<Buffer> {

  // build the exact filter chain you had: scale → pad → rgb24
  const vf = [
    `scale=${nw}:${nh}:flags=lanczos+accurate_rnd+full_chroma_inp`,     // high-quality resize
    `pad=${SIDE}:${SIDE}:0:0:black`,       // pad right/bottom with black
    'format=rgb24'                         // return raw RGB24
  ].join(',');

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    ffmpeg(file)
      .outputOptions('-vf', vf, '-vframes', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24')
      .on('error', reject)
      .on('end', () => resolve(Buffer.concat(chunks)))
      .pipe()                        // stdout → Node stream
      .on('data', chunk => chunks.push(chunk));
  });
}



/* ------------------------------------------------------------------ */
/* 3.  PUBLIC entry: detect & crop faces                               */
/* ------------------------------------------------------------------ */

export async function processFacesOnImageNEW(filePath: string) {

    await faceSetupOnce();

    const { tensor, scale, dx, dy, side, width, height } =
            await preprocessNode(filePath);

    const feeds: Record<string, ort.Tensor> = {};
    feeds[scrfdSess.inputNames[0]] = tensor;
    const detOut = await scrfdSess.run(feeds);

    const faces = getFaces(detOut, scrfdSess, scale, dx, dy, side);

    if (faces.length === 0) return 0;

    await fs.mkdir(OUT_DIR, { recursive: true });
    const fileStem = path.parse(filePath).name;

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

        const kpsLocal = kpsBigger.map((v,i) => i % 2 === 0 ? v - leftInt : v - topInt);
        await ffmpegCrop112(filePath, path.join(OUT_DIR, `${fileStem}_face${idx}.png`), leftInt, topInt, sideInt);
        
        
        // const raw112    = await ffmpegCrop112Raw(filePath, leftInt, topInt, sideInt);
        const raw112 = await ffmpegAligned112Raw(filePath, kpsBigger, -5) //kpsLocal); //use local if crop path is used

        await saveRawRGB24AsPng(raw112, 
          112,// width
          112,// height
          path.join(OUT_DIR, `${fileStem}_face${idx}_aligned.png`)
        );

        const tensor112 = rgb24ToTensor112(raw112);
        console.log(`face ${idx} tensor dims →`, tensor112.dims);  // should log [1,3,112,112]

        const embOut = await arcSess!.run({ [arcSess!.inputNames[0]]: tensor112 });
        const emb    = embOut[arcSess!.outputNames[0]].data as Float32Array;
        l2Normalize(emb);
        console.log(`face ${idx} emb[0..4] →`, Array.from(emb.slice(0,5)));
        const norm = Math.sqrt(emb.reduce((s,x) => s + x*x, 0));
        console.log(`face ${idx} L2 →`, norm.toFixed(3));

        ++idx;
    }

    return faces.length;          // let caller know how many we saved
}
  







function ffmpegCrop112(
  src : string,
  dst : string,
  left: number,
  top : number,
  side: number
): Promise<void> {

  const vf = `crop=${side}:${side}:${left}:${top},scale=112:112:flags=lanczos`;

  return new Promise((res, rej) => {
    ffmpeg(src)
      .outputOptions(
        '-vf',      vf,
        '-frames:v','1',   // exactly one frame
        '-c:v',     'png', // encode with PNG codec
        '-pix_fmt', 'rgb24'
      )
      .save(dst)
      .on('error', rej)
      .on('end',   () => res());
  });
}


function ffmpegCrop112Raw(
  src : string,
  left: number,
  top : number,
  side: number
): Promise<Buffer> {

  const vf = `crop=${side}:${side}:${left}:${top},scale=112:112:flags=lanczos`;

  return new Promise((res, rej) => {
    const chunks: Buffer[] = [];
    ffmpeg(src)
      .outputOptions(
        '-vf',       vf,
        '-frames:v', '1',
        '-f',        'rawvideo',
        '-pix_fmt',  'rgb24'
      )
      .on('error', rej)
      .on('end', () => res(Buffer.concat(chunks)))
      .pipe()
      .on('data', c => chunks.push(c));
  });
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







/**
 * Build an FFmpeg perspective filter that maps the 112×112
 * canonical template onto the source image via 5-point similarity.
 */



function ffmpegAligned112Raw(
  src : string,
  kps : number[], // 10 numbers, full-image coords
  marginPx = 0
): Promise<Buffer> {

  // 1. canonical InsightFace template -------------------------
  const CAN112 = [
    {x:38.2946, y:51.69633 + marginPx},
    {x:73.5318, y:51.50143 + marginPx},
    {x:56.0252, y:71.73663 + marginPx},
    {x:41.5493, y:92.36553 + marginPx},
    {x:70.7299, y:92.20413 + marginPx}
  ];

  // 2. landmarks detected on current face ---------------------
  const srcPts = [0,2,4,6,8].map(i => ({x:kps[i], y:kps[i+1]}));

  // 3. similarity transform using nudged ----------------------
  const tfm = nudged.estimators.TSR(srcPts, CAN112);      // src → dst
  const M = nudged.transform.toMatrix(tfm);               // a,b,c,d,e,f

  // 4. convert to 3×3 matrix and invert (FFmpeg needs dst→src)
  const A = [ [M.a,M.c,M.e],
              [M.b,M.d,M.f],
              [0 ,  0 , 1 ] ];
  const inv = mathInverse(A);  // use a tiny 3×3 inverse helper

  // 5. sample coordinates of output corners back in input img
  const map = (x:number,y:number) => {
    const u = inv[0][0]*x + inv[0][1]*y + inv[0][2];
    const v = inv[1][0]*x + inv[1][1]*y + inv[1][2];
    const w = inv[2][0]*x + inv[2][1]*y + inv[2][2];
    return [u/w, v/w];
  };
// 0,0   → top‑left
const [x0,y0] = map(0  , 0  );
// 111,0 → top‑right
const [x1,y1] = map(111, 0  );
// 0,111 → bottom‑left   ← changed
const [x2,y2] = map(0  , 111);
// 111,111 → bottom‑right ← changed
const [x3,y3] = map(111, 111);

const vf = `perspective=` +
           `x0=${x0}:y0=${y0}:x1=${x1}:y1=${y1}:` +
           `x2=${x2}:y2=${y2}:x3=${x3}:y3=${y3},` +
           `scale=112:112:flags=lanczos`;

  // 6. run FFmpeg and return raw rgb24 bytes ------------------
  return new Promise((res,rej)=>{
    const chunks:Buffer[]=[];
    ffmpeg(src)
      .outputOptions('-vf',vf,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24')
      .on('error',rej)
      .on('end',()=>res(Buffer.concat(chunks)))
      .pipe()
      .on('data',c=>chunks.push(c));
  });
}





/*
If you ever decide to work with just a similarity (affine) matrix instead of perspective you can replace the filter with an affine‑style transform filter:

const a =  M.a, b = M.b, c = M.e,
      d =  M.c, e = M.d, f = M.f;  // src → dst, no inversion
const vf = `transform=${a}:${b}:${c}:${d}:${e}:${f},scale=112:112`;
*/