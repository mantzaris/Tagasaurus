// TODO: production link to extra resources:
// ort-wasm-simd.mjs              ort-wasm-simd.wasm
//ort-wasm-simd-threaded.mjs     ort-wasm-simd-threaded.wasm   (or the non-SIMD versions)

//(buffalo l model) https://github.com/deepinsight/insightface/releases/tag/v0.7
//scrfd 10G kps model sha256sum, 5838f7fe053675b1c7a08b633df49e7af5495cee0493c7dcf6697200b85b5b91
//ArcFace-R50 w600k_r50.onnx model sha256sum, 4c06341c33c2ca1f86781dab0e829f88ad5b64be9fba56e56bc9ebdefc619e43

//TODO: use OffscreenCanvas instead of DOM canvas (faster less memory and goes on worker)

// Disable browser cache during development as mentioned in README
import nudged from 'nudged';
import { initializeOnnxRuntime, ort, env } from './onnx-init';

//configuration

//MUST match constants in backend/face.ts
const DEFAULT_MARGIN = 0.30; //for the face detection box
const FACE_DET_BOX_SHIFT = -5;

//InsightFace 112×112 canonical template
const CANONICAL_112 = [
  {x:38.2946, y:51.6963 + FACE_DET_BOX_SHIFT},
  {x:73.5318, y:51.5014 + FACE_DET_BOX_SHIFT},
  {x:56.0252, y:71.7366 + FACE_DET_BOX_SHIFT},
  {x:41.5493, y:92.3655 + FACE_DET_BOX_SHIFT},
  {x:70.7299, y:92.2041 + FACE_DET_BOX_SHIFT}
];

interface FaceDetections {
  score : number;
  box   : number[]; //[x1,y1,x2,y2] in original image pixels
  kps   : number[]; //10 values (x0,y0,…,x4,y4) (5 points of landmarks)
}

let detectSession: any;
let embedSession: any;

let lastImg   : HTMLImageElement | null = null; // keep pixels around
let lastFaces : FaceDetections[] = []; // result of getFaces()

export async function facesSetUp() {

  try {    
    ({detectSession, embedSession} = await initializeOnnxRuntime());

    lastImg = null;
    lastFaces = [];

    return true;
  } catch {
    return false;
  }
}

export async function detectFacesInImage(imgEl: HTMLImageElement): Promise<{id:number; box:number[]; kps:number[]}[]> {
  lastImg = imgEl; //keep for embed step
  const {tensor, scale, dx, dy, side} = preprocessImage(imgEl);

  console.log(`in detectFacesInImage, detectSession = ${detectSession}`);

  const feeds: Record<string, any> = {};
  feeds[detectSession.inputNames[0]] = tensor;
  const detectionOut = await detectSession.run(feeds);

  lastFaces = getFaces(detectionOut, detectSession, scale, dx, dy, side);

  // map to a lighter object for the UI
  return lastFaces.map((f,i) => ({ id: i, box: f.box, kps: f.kps }));
}

export async function embedFace(id: number): Promise<Float32Array|null> {
  if (!lastImg || !lastFaces[id]) return null;

  const { boxBigger, kpsBigger } =
        scaleFaceBox(lastImg, lastFaces[id].box, lastFaces[id].kps);

  const cv112 = make112Face(kpsBigger, lastImg);
  return await getEmbedding(cv112, embedSession);     // <- sequential
}


function getFaces(detectionOut: Record<string, any>, sess : any, scale=1, dx=0, dy=0, side =640, confTh=0.55): FaceDetections[] {
  console.log('getFaces start')
  const σ = (x:number)=>1/(1+Math.exp(-x));
  const strides=[8,16,32];
  const faces: FaceDetections[] = [];

  for (let i=0;i<strides.length;++i) {
    const s=strides[i];
    const scores = detectionOut[sess.outputNames[i]].data  as Float32Array;
    const deltas = detectionOut[sess.outputNames[i+3]].data as Float32Array;
    const kraw   = detectionOut[sess.outputNames[i+6]].data as Float32Array;
    const g = side / s;

    for (let y=0;y<g;++y)
      for (let x=0;x<g;++x)
        for (let a=0;a<2;++a) {
          const idx=(y*g+x)*2+a;
          const p = σ(scores[idx]);
          if (p < confTh) continue; //keep only good boxes!

          const cx=(x+0)*s, cy=(y+0)*s;
          const o4 = idx*4, o10 = idx*10;
          const l=deltas[o4]*s, t=deltas[o4+1]*s,
                r=deltas[o4+2]*s, b=deltas[o4+3]*s;

          const box = [
            (cx-l-dx)/scale, (cy-t-dy)/scale,
            (cx+r-dx)/scale, (cy+b-dy)/scale
          ];

          const kps = new Array<number>(10);
          for (let k=0;k<5;++k) {
            kps[2*k]   = (cx + kraw[o10+2*k  ]*s - dx)/scale;
            kps[2*k+1] = (cy + kraw[o10+2*k+1]*s - dy)/scale;
          }
          faces.push({score:p, box, kps});
        }
  }
  /* ----  very small NMS just to merge twins  ---- */
  faces.sort((a,b)=>b.score-a.score);
  const result:FaceDetections[]=[];
  const iou = (a:number[],b:number[])=>{
    const x1=Math.max(a[0],b[0]), y1=Math.max(a[1],b[1]);
    const x2=Math.min(a[2],b[2]), y2=Math.min(a[3],b[3]);
    const inter=Math.max(0,x2-x1)*Math.max(0,y2-y1);
    const ua=(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-inter;
    return inter/ua;
  };
  faces.forEach(f=>{
    if (result.every(r=>iou(f.box,r.box)<0.3)) result.push(f);
  });
  return result;
}


//canvas112->L2-normalised 512-D embedding
async function getEmbedding(cnv: HTMLCanvasElement, session: any): Promise<Float32Array> {
  
  console.log(`in getEmbedding`);

  const tensor = canvasToTensor(cnv);
  const feeds: Record<string, any> = {};
  feeds[session.inputNames[0]] = tensor;

  const out = await session.run(feeds);
  const emb = out[session.outputNames[0]].data as Float32Array;

  // L2-normalise
  let norm = 0;
  for (let i = 0; i < emb.length; ++i) norm += emb[i]*emb[i];
  norm = Math.sqrt(norm);
  for (let i = 0; i < emb.length; ++i) emb[i] /= norm;

  return emb;
}


function canvasToTensor(cnv: HTMLCanvasElement) {
  const W = 112, H = 112, size = W * H;
  const imgData = cnv.getContext('2d')!.getImageData(0,0,W,H).data;
  const arr = new Float32Array(3 * size);
  for (let i = 0; i < size; ++i) {
    const r = imgData[i*4    ];
    const g = imgData[i*4 + 1];
    const b = imgData[i*4 + 2];
    // InsightFace expects BGR, (v-127.5)/128
    arr[i]          = (b - 127.5) / 128;
    arr[i +   size] = (g - 127.5) / 128;
    arr[i + 2*size] = (r - 127.5) / 128;
  }
  return new (ort as any).Tensor('float32', arr, [1,3,H,W]);
}


export function make112Face(kps10: number[], image: HTMLImageElement): HTMLCanvasElement {
  console.log('make112Face start')
  //build source landmark list (detected points)
  const srcPts = [
    {x: kps10[0], y: kps10[1]},   // left eye
    {x: kps10[2], y: kps10[3]},   // right eye
    {x: kps10[4], y: kps10[5]},   // nose
    {x: kps10[6], y: kps10[7]},   // mouth-L
    {x: kps10[8], y: kps10[9]}    // mouth-R
  ];
  
  //similarity (Translate-Scale-Rotate)  one-object API
  const tfm = nudged.estimators.TSR(srcPts, CANONICAL_112);     
  
  //to 3x3 DOM matrix {a,b,c,d,e,f}
  const m = nudged.transform.toMatrix(tfm);
  
  const cv = document.createElement('canvas');
  console.log("foo: ",cv.width, cv.height)
  cv.width  = cv.height = 112;
  console.log("bar: ",cv.width, cv.height)
  const ctx = cv.getContext('2d')!;
  
  ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
  ctx.drawImage(image, 0, 0);
  console.log("baz: ",cv.width, cv.height)
  return cv;
}

export function scaleFaceBox(img: HTMLImageElement, box: number[], kps: number[]) {
  console.log('scaleFaceBox start')
  let [x1,y1,x2,y2] = box;
  const w = x2-x1, h = y2-y1; //TODO: make closer to 0.3 which is the backend

  x1 = Math.max(0, x1 - w*DEFAULT_MARGIN);
  y1 = Math.max(0, y1 - h*DEFAULT_MARGIN);
  x2 = Math.min(img.width , x2 + w*DEFAULT_MARGIN);
  y2 = Math.min(img.height, y2 + h*DEFAULT_MARGIN);

  const kNew = kps.slice();//copies
  
  for (let i=0;i<5;++i) {
    kNew[2*i]   = Math.min(Math.max(kNew[2*i]  , x1), x2);
    kNew[2*i+1] = Math.min(Math.max(kNew[2*i+1], y1), y2);
  }

  return { boxBigger:[x1,y1,x2,y2], kpsBigger:kNew };
}


// Preprocess image for the model match Python cv2.dnn.blobFromImage parameters
//TODO: createImageBitmap + OffscreenCanvas tob e non-blocking
function preprocessImage(img: HTMLImageElement) {

  const S = 640; // model side
  const scale = Math.min(S / img.width, S / img.height);    // keep aspect
  const nw = Math.round(img.width  * scale);
  const nh = Math.round(img.height * scale);
  const dx = 0, dy = 0;                                     // top-left paste

  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#000'; // black padding as said in the readme/docs
  ctx.fillRect(0, 0, S, S);
  ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, nw, nh);

  // ---- canvas (RGBA) Float32 CHW in   B G R  order!
  const rgba = ctx.getImageData(0, 0, S, S).data;
  const chw  = new Float32Array(3 * S * S);
  const size = S * S;
  for (let i = 0; i < size; ++i) {
    const r = rgba[i*4    ];
    const g = rgba[i*4 + 1];
    const b = rgba[i*4 + 2];
    chw[i]          = (b - 127.5) / 128; //B (swap!)
    chw[i +   size] = (g - 127.5) / 128; //G
    chw[i + 2*size] = (r - 127.5) / 128; //R (swap!)
  }

  const tensor = new (ort as any).Tensor('float32', chw, [1, 3, S, S]);
  
  return { tensor, scale, dx, dy, side: S }; //return { tensor, scale, dx, dy };
}




