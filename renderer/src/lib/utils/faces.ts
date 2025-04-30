// SCRFD Face Detection Implementation with Proper Anchor Generation and Coordinate Transformation
// TODO: production link to extra resources:
// ort-wasm-simd.mjs              ort-wasm-simd.wasm
//ort-wasm-simd-threaded.mjs     ort-wasm-simd-threaded.wasm   (or the non-SIMD versions)

//(buffalo l model) https://github.com/deepinsight/insightface/releases/tag/v0.7
//scrfd 10G kps model sha256sum, 5838f7fe053675b1c7a08b633df49e7af5495cee0493c7dcf6697200b85b5b91
//w600k_r50.onnx model sha256sum, 4c06341c33c2ca1f86781dab0e829f88ad5b64be9fba56e56bc9ebdefc619e43


import * as onnxruntime from 'onnxruntime-web';
import nudged from 'nudged';

// Configuration
const MODEL_PATH = '/assets/models/buffalo_l/det_10g.onnx';//scrfd10Gkps/scrfd_10g_bnkps.onnx';//https://huggingface.co/ByteDance/InfiniteYou/resolve/main/supports/insightface/models/antelopev2/scrfd_10g_bnkps.onnx
const IMAGE_PATH = '/assets/images/face.jpg';

// Main function to run face detection
async function detectFaces(): Promise<void> {
  try {
    console.log("\n --------------- \n ---------------\n")
    
    const {canvas, image} = await imageSetup();
    const {tensor, scale, dx, dy} = preprocessImage(image);
    console.time("session");
    const session = await onnxruntime.InferenceSession.create(MODEL_PATH);
    console.timeEnd("session");
    
    // Run inference
    const feeds: Record<string, any> = {};
    feeds[session.inputNames[0]] = tensor;    
    const modelOutputs = await session.run(feeds);
    console.log('outputData = ', modelOutputs);
    
    // const { box, kps, best } = getBestBox(outputData, session);
    const { box, kps, best } = getBestBox(
             modelOutputs, session,
             scale, dx, dy, //3 mapping values
             640)

    console.log(`best box = ${best}`);

    const minScore   = 0.55; // empirical
    const minAreaPct = 0.05; // 5 % of frame
    const maxAreaPct = 0.8;
    const area       = (box[2]-box[0]) * (box[3]-box[1]);
    const areaMin    = minAreaPct * image.width * image.height;
    const areaMax    = maxAreaPct * image.width * image.height;
    
    if (best < minScore || area < areaMin || area > areaMax) {
      console.warn(`rejected - score=${best.toFixed(3)}, area=${(area / (image.width*image.height)*100).toFixed(2)} %`);
      return; //skip draw/crop/ArcFace
    }
    
    const { boxBigger, kpsBigger } = scaleFaceBox( image, box, kps );

    
    drawBoxKps(canvas, box, kps);
    drawBoxKps(canvas, boxBigger, kpsBigger, 'green', 'purple');

    //arcface 112------------------------------
    make112Face(kpsBigger, image);

  } catch (error) {
    console.error('Error in face detection:', error);
  }
}


function make112Face(kpsBigger: number[], image: HTMLImageElement) {
  function applyMatrix(p:{x:number,y:number}, m:{a:number,b:number,c:number,d:number,e:number,f:number}) {
    return {
      x: m.a * p.x + m.c * p.y + m.e,
      y: m.b * p.x + m.d * p.y + m.f
    };
  }
  //build source landmark list (detected points)
  const srcPts = [
    {x: kpsBigger[0], y: kpsBigger[1]},   // left eye
    {x: kpsBigger[2], y: kpsBigger[3]},   // right eye
    {x: kpsBigger[4], y: kpsBigger[5]},   // nose
    {x: kpsBigger[6], y: kpsBigger[7]},   // mouth-L
    {x: kpsBigger[8], y: kpsBigger[9]}    // mouth-R
  ];

  //InsightFace 112×112 canonical template
  const dstPts = [
    {x:38.2946, y:51.6963},
    {x:73.5318, y:51.5014},
    {x:56.0252, y:71.7366},
    {x:41.5493, y:92.3655},
    {x:70.7299, y:92.2041}
  ];
  
  //similarity (Translate-Scale-Rotate)  one-object API
  const tfm = nudged.estimators.TSR(srcPts, dstPts);     
  
  //to 3×3 DOM matrix {a,b,c,d,e,f}
  const m = nudged.transform.toMatrix(tfm);              
  
  //warp to 112×112
  const canvas112 = document.createElement('canvas');
  canvas112.width = canvas112.height = 112;
  const ctx112 = canvas112.getContext('2d')!;
  ctx112.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
  ctx112.drawImage(image, 0, 0);          // image from imageSetup()
  ctx112.setTransform(1, 0, 0, 1, 0, 0);     // reset to identity
  
  const warped = srcPts.map(pt => applyMatrix(pt, m));

  ctx112.fillStyle = 'magenta';
  warped.forEach(p => ctx112.fillRect(p.x - 1, p.y - 1, 3, 3));

  let err = 0;
  for (let i = 0; i < 5; ++i) {
    const dx = warped[i].x - dstPts[i].x;
    const dy = warped[i].y - dstPts[i].y;
    err += Math.hypot(dx, dy);
  }

  console.log('mean landmark error =', (err / 5).toFixed(2), 'px');
      
  document.body.appendChild(canvas112);  
}



function drawBoxKps(canvas: HTMLCanvasElement, box: number[], kps: number[], boxColor: string = 'yellow', landmarkColor: string = 'red') {
  const ctx = canvas.getContext("2d"); 

  if(ctx) {

    ctx.strokeStyle = boxColor;
    ctx.lineWidth   = 4;

    ctx.strokeRect(box[0], box[1], box[2]-box[0], box[3]-box[1]);
    ctx.fillStyle = landmarkColor;
    for(let i=0;i<5;i++){
      ctx.beginPath();
      ctx.arc(kps[2*i], kps[2*i+1], 3, 0, Math.PI*2);
      ctx.fill();
    }
    
  }
}

function scaleFaceBox(img: HTMLImageElement,
  box: number[], kps: number[]) {

  let [x1,y1,x2,y2] = box;
  const margin = 0.15, w = x2-x1, h = y2-y1;

  x1 = Math.max(0, x1 - w*margin);
  y1 = Math.max(0, y1 - h*margin);
  x2 = Math.min(img.width , x2 + w*margin);
  y2 = Math.min(img.height, y2 + h*margin);

  const kNew = kps.slice();//copies
  
  for (let i=0;i<5;++i){
    kNew[2*i]   = Math.min(Math.max(kNew[2*i]  , x1), x2);
    kNew[2*i+1] = Math.min(Math.max(kNew[2*i+1], y1), y2);
  }

  return { boxBigger:[x1,y1,x2,y2], kpsBigger:kNew };
}


async function imageSetup() {
  //create canvas for visualization
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  
  //load the image
  const image = new Image();
  image.src = IMAGE_PATH;
  
  await new Promise<void>((resolve) => {
    image.onload = () => {
      console.log(`Image loaded: ${image.width}x${image.height}`);
      
      //set canvas size to match image
      canvas.width = image.width;
      canvas.height = image.height;
      
      //draw original image on canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(image, 0, 0);
      }
      
      resolve();
    };
    image.onerror = () => {
      console.error('Failed to load image');
      resolve();
    };
  });

  return {canvas, image};
}

// Preprocess image for the model match Python cv2.dnn.blobFromImage parameters
function preprocessImage(img: HTMLImageElement) {
  console.time("preprocessImage");
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
  const tensor = new (onnxruntime as any).Tensor('float32', chw, [1, 3, S, S]);
  console.timeEnd("preprocessImage");
  return { tensor, scale, dx, dy, side: S }; //return { tensor, scale, dx, dy };
}


function getBestBox(
  out: Record<string, any>,
  sess: any,
  scale = 1,
  dx = 0,
  dy = 0, side=640
) {
  console.time("getBestBox");
  const σ = (x:number)=>1/(1+Math.exp(-x));
  const strides=[8,16,32];
  let best=0, box=[0,0,0,0], kps=[0,0,0,0,0,0,0,0,0,0];

  for(let i=0;i<strides.length;++i){
    const s=strides[i];
    const scores = out[sess.outputNames[i    ]].data as Float32Array;
    const deltas = out[sess.outputNames[i+3]].data as Float32Array;
    const kraw   = out[sess.outputNames[i+6]].data as Float32Array;

    const g = side / s; //const g=640/s;

    for(let y=0;y<g;++y)
      for(let x=0;x<g;++x)
        for(let a=0;a<2;++a){
          const idx=(y*g+x)*2+a;
          const p=σ(scores[idx]);
          if(p<=best) continue;

          const cx=(x+0.0)*s, cy=(y+0.0)*s,
                o4=idx*4, o10=idx*10;
          const l=deltas[o4]*s, t=deltas[o4+1]*s,
                r=deltas[o4+2]*s, b=deltas[o4+3]*s;

          best=p;
          box=[cx-l, cy-t, cx+r, cy+b];

          for(let k=0;k<5;++k){
            const px = cx + kraw[o10+2*k  ]*s;
            const py = cy + kraw[o10+2*k+1]*s;
            kps[2*k]   = (px - dx) / scale;   // map here
            kps[2*k+1] = (py - dy) / scale;   //
          }
        }
  }

  box = [
    (box[0]-dx)/scale, (box[1]-dy)/scale,
    (box[2]-dx)/scale, (box[3]-dy)/scale
  ];
  console.timeEnd("getBestBox");
  return { box, kps, best };
}



// Auto-run detection when script is loaded
detectFaces().catch(error => {
  console.error('Error in face detection:', error);
});



// console.log('session input names: ', session.inputNames)
// console.log('session output names: ', session.outputNames)