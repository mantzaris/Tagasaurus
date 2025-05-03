import * as ort   from 'onnxruntime-node';
import sharp      from 'sharp';//TODO: image-js fo no Libvips dependency
import nudged     from 'nudged';
import * as path  from 'path';
import * as fs    from 'fs/promises';

//TODO: not thread safe, make the onnx file uses singletons or put on worker threads to be safe

const MODELS_DIR  = path.join(__dirname, '..', '..', '..', '..', 'models', 'buffalo_l');
const OUT_DIR    = '/home/resort/Pictures/temp1';           // make sure it exists!
const PAD_FACE = true; 

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
  
  /** parse SCRFD outputs exactly like your renderer version              */
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
  
  /** sharp-based preprocessing   -> 640×640 Float32 CHW tensor            */
async function preprocessNode(filePath: string) {
    const SIDE = 640;
  
    const imgSharp = sharp(filePath).rotate();               // EXIF-aware
    const meta      = await imgSharp.metadata();
    if (!meta.width || !meta.height) throw new Error('Cannot read image dims');
  
    const scale = Math.min(SIDE/meta.width, SIDE/meta.height);
    const nw    = Math.round(meta.width  * scale);
    const nh    = Math.round(meta.height * scale);
  
    // resize, letter-box left-top (black pad right/bottom)
    const paddedRGB = await imgSharp
      .resize(nw, nh)
      .extend({
        top:    0,
        left:   0,
        bottom: SIDE - nh,
        right:  SIDE - nw,
        background: { r:0, g:0, b:0 }
      })
      .raw()
      .toBuffer();
  
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
  
/* ------------------------------------------------------------------ */
/* 3.  PUBLIC entry: detect & crop faces                               */
/* ------------------------------------------------------------------ */

export async function processFacesOnImage(filePath: string) {

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
        //const [x1,y1,x2,y2] = f.box.map(Math.round);// integer-ise & clamp to image bounds
        const { boxBigger, kpsBigger } = PAD_FACE
            ? scaleFaceBox({ width, height }, face.box, face.kps, 0.18)
            : { boxBigger: face.box, kpsBigger: face.kps };


        // const { boxBigger } =
        //   scaleFaceBox({ width, height }, face.box, face.kps, 0.18);

        const [x1, y1, x2, y2] = boxBigger.map(Math.round);

        await sharp(filePath)
        .extract({
            left  : Math.max(0, x1),
            top   : Math.max(0, y1),
            width : Math.max(1, x2 - x1),
            height: Math.max(1, y2 - y1)
        })
        .resize(112, 112)        // still square-resize for now
        .png()
        .toFile(path.join(OUT_DIR, `${fileStem}_face${idx}.png`));

        ++idx;
    }

    return faces.length;          // let caller know how many we saved
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















// //TODO: optimize
// // full pipeline makes one embedding per detected face
// export async function processFacesOnImage(
//     filePath: string
//   ): Promise<Float32Array[]> {

//     await faceSetupOnce();
  
//     // load & letter-box 640×640 RGB 
//     const { data: rgb640 } = await sharp(filePath)
//       .resize(640, 640, { fit: 'contain', background: '#000' })
//       .raw()
//       .toBuffer({ resolveWithObject: true });
  
//     /* 2. SCRFD */
//     const chw = new Float32Array(3 * 640 * 640);
//     const size = 640 * 640;
//     for (let i = 0; i < size; ++i) {
//       const r = rgb640[i*3    ];
//       const g = rgb640[i*3 + 1];
//       const b = rgb640[i*3 + 2];
//       chw[i]          = (b - 127.5) / 128;
//       chw[i +   size] = (g - 127.5) / 128;
//       chw[i + 2*size] = (r - 127.5) / 128;
//     }
//     const det = await scrfdSess.run({
//       [scrfdSess.inputNames[0]]: new ort.Tensor('float32', chw, [1, 3, 640, 640])
//     });
//     const faces = getFaces(det, scrfdSess);
  
//     //align + embed every face
//     const embs: Float32Array[] = [];

//     const fileDir  = '/home/resort/Pictures/temp1';                // ← folder of the running module
//     const fileStem = path.parse(filePath).name; 

//     for (const [idx, f] of faces.entries()) {
//     //   const buf112 = await make112FaceNode(rgb640, f.kps);
//     //   embs.push(await getEmbeddingNode(buf112));

//     const buf112 = await make112FaceNode(rgb640, f.kps);
//     const emb    = await getEmbeddingNode(buf112);

//     const outPng = path.join(fileDir, `${fileStem}_face${idx}.png`);
//     await sharp(buf112, { raw: { width:112, height:112, channels:3 } })
//           .png()
//           .toFile(outPng);

//         // if (f.score < 0.55) continue;                         // weak confidence
//         // const aw = f.box[2] - f.box[0];
//         // const ah = f.box[3] - f.box[1];
//         // const area = aw * ah;
//         // if (area < 0.05 * 640 * 640 || area > 0.8 * 640 * 640) continue;

        


//         if (!Number.isNaN(emb[0])) embs.push(emb);
//     }
//     return embs;
// }

// // run ArcFace & return **L2-normalised** 512-D embedding
// async function getEmbeddingNode(buf112: Buffer): Promise<Float32Array> {
//     const feeds = { [arcSess.inputNames[0]]: bufferToTensor112(buf112) };
//     const out   = await arcSess.run(feeds);
//     const emb   = out[arcSess.outputNames[0]].data as Float32Array;
  
//     //L2 normalise in-place
//     let n = 0;
//     for (const v of emb) n += v * v;
//     n = Math.sqrt(n);
//     for (let i = 0; i < emb.length; ++i) emb[i] /= n;
//     if (n !== 0) {                                    // ❷ guard against zero
//         n = Math.sqrt(n);
//         for (let i = 0; i < emb.length; ++i) emb[i] /= n;
//     }
//     return emb;
// }

// //SCRFD post-process (unchanged logic, minimal tweaks)
// function getFaces(
//     detOut : Record<string, ort.Tensor>,
//     sess   : ort.InferenceSession,
//     scale  = 1,
//     dx     = 0,
//     dy     = 0,
//     side   = 640,
//     confTh = 0.55
//   ): FaceDet[] {
  
//     const σ = (x: number) => 1 / (1 + Math.exp(-x));
//     const strides = [8, 16, 32];
//     const faces: FaceDet[] = [];
  
//     for (let head = 0; head < strides.length; ++head) {
//       const s      = strides[head];
//       const scores = detOut[sess.outputNames[head    ]].data as Float32Array;
//       const delta  = detOut[sess.outputNames[head + 3]].data as Float32Array;
//       const kraw   = detOut[sess.outputNames[head + 6]].data as Float32Array;
//       const g      = side / s;
  
//       for (let y = 0; y < g; ++y)
//         for (let x = 0; x < g; ++x)
//           for (let a = 0; a < 2; ++a) {
//             const idx = (y * g + x) * 2 + a;
//             const p   = σ(scores[idx]);
//             if (p < confTh) continue;
  
//             const cx = (x + 0) * s, cy = (y + 0) * s;
//             const o4 = idx * 4, o10 = idx * 10;
//             const l = delta[o4] * s, t = delta[o4+1] * s,
//                   r = delta[o4+2] * s, b = delta[o4+3] * s;
  
//             const box = [
//               (cx - l - dx) / scale, (cy - t - dy) / scale,
//               (cx + r - dx) / scale, (cy + b - dy) / scale
//             ];
  
//             const kps = new Array<number>(10);
//             for (let k = 0; k < 5; ++k) {
//               kps[2*k]   = (cx + kraw[o10+2*k  ] * s - dx) / scale;
//               kps[2*k+1] = (cy + kraw[o10+2*k+1] * s - dy) / scale;
//             }
//             faces.push({ score: p, box, kps });
//           }
//     }
  
//     //tiny NMS to merge twins
//     faces.sort((a, b) => b.score - a.score);
//     const result: FaceDet[] = [];
//     const iou = (a: number[], b: number[]) => {
//       const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]);
//       const x2 = Math.min(a[2], b[2]), y2 = Math.min(a[3], b[3]);
//       const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
//       const ua =
//         (a[2] - a[0]) * (a[3] - a[1]) +
//         (b[2] - b[0]) * (b[3] - b[1]) -
//         inter;
//       return inter / ua;
//     };
//     faces.forEach(f => {
//       if (result.every(r => iou(f.box, r.box) < 0.3)) result.push(f);
//     });
//     return result;
// }


// function bufferToTensor112(buf: Buffer): ort.Tensor {
//     const size = 112 * 112;
//     const out  = new Float32Array(3 * size);
//     for (let i = 0; i < size; ++i) {
//       const r = buf[i * 3    ];
//       const g = buf[i * 3 + 1];
//       const b = buf[i * 3 + 2];
//       out[i]          = (b - 127.5) / 128;
//       out[i +   size] = (g - 127.5) / 128;
//       out[i + 2*size] = (r - 127.5) / 128;
//     }
//     return new ort.Tensor('float32', out, [1, 3, 112, 112]);
// }

// //align 5-point landmarks ⇒ 112×112 face crop (RGB raw buffer)
// async function make112FaceNode(
//     rgb640: Buffer, // sharp raw RGB 640×640×3
//     kps10 : number[]
// ): Promise<Buffer> {

//     //similarity transform with nudged
//     const srcPts: Point[] = [
//         { x: kps10[0], y: kps10[1] },
//         { x: kps10[2], y: kps10[3] },
//         { x: kps10[4], y: kps10[5] },
//         { x: kps10[6], y: kps10[7] },
//         { x: kps10[8], y: kps10[9] }
//     ];

//     //const tfm = nudged.estimators.TSR(srcPts, CANONICAL_112); //[...CANONICAL_112]);
//     const tfm = nudged.estimators.TSR(srcPts, [...CANONICAL_112]);
    
//     const m   = nudged.transform.toMatrix(tfm);   // {a,b,c,d,e,f}

//     //warp + crop with Sharp (no libvips on user system needed)
//     const buf112 = await sharp(rgb640, {
//         raw: { width: 640, height: 640, channels: 3 }
//         })
//         .affine(
//         [[m.a, m.c], [m.b, m.d]],
//         {
//             idx: m.e, idy: m.f,                // translation
//             background: { r: 0, g: 0, b: 0 },
//             interpolator: 'bilinear'
//         }
//         )
//         .extract({ left: 0, top: 0, width: 112, height: 112 })
//         .raw()
//         .toBuffer();

//     return buf112;
// }