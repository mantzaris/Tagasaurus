import * as ort   from 'onnxruntime-node';
import sharp      from 'sharp';//TODO: image-js fo no Libvips dependency
import nudged     from 'nudged';
import * as path  from 'path';
import * as fs    from 'fs/promises';

//TODO: not thread safe, make the onnx file uses singletons or put on worker threads to be safe

const MODELS_DIR  = path.join(__dirname, '..', '..', '..', '..', 'models', 'buffalo_l');
const OUT_DIR    = '/home/resort/Pictures/temp1';           // make sure it exists!

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


        await sharp(filePath)
            .extract({ left: leftInt,
                    top : topInt,
                    width : sideInt,
                    height: sideInt })
            .resize(112,112)          // now square, zero distortion
            .png()
            .toFile(path.join(OUT_DIR, `${fileStem}_face${idx++}.png`));

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







