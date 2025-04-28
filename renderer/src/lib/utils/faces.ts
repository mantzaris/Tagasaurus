// SCRFD Face Detection Implementation with Proper Anchor Generation and Coordinate Transformation
// TODO: production link to extra resources:
// ort-wasm-simd.mjs              ort-wasm-simd.wasm
//ort-wasm-simd-threaded.mjs     ort-wasm-simd-threaded.wasm   (or the non-SIMD versions)


import * as onnxruntime from 'onnxruntime-web';

// Configuration
const MODEL_PATH = '/assets/models/scrfd10Gkps/scrfd_10g_bnkps.onnx';
const IMAGE_PATH = '/assets/images/face.jpg';

// Main function to run face detection
async function detectFaces(): Promise<void> {
  try {
    console.log("\n --------------- \n ---------------\n")
    console.log('Loading model and image...');
    
    const {canvas, image} = await imageSetup();
    const {tensor, scale, dx, dy} = preprocessImage(image);
    console.time("session");
    const session = await onnxruntime.InferenceSession.create(MODEL_PATH);
    console.timeEnd("session");
    console.log('session input names: ', session.inputNames)
    console.log('session output names: ', session.outputNames)
      
    // Run inference
    const feeds: Record<string, any> = {};
    feeds[session.inputNames[0]] = tensor;
    
    const outputData = await session.run(feeds);
    console.log('outputData = ', outputData);
    
    const { box, kps, best } = getBestBox(outputData, session);

    const ctx = canvas.getContext("2d"); 
    /* draw box */
    if(ctx) {

      ctx.strokeStyle = 'yellow';
      ctx.lineWidth   = 4;

      ctx.strokeRect(box[0], box[1], box[2]-box[0], box[3]-box[1]);
      ctx.fillStyle='cyan';
      for(let i=0;i<5;i++){
        ctx.beginPath();
        ctx.arc(kps[2*i], kps[2*i+1], 3, 0, Math.PI*2);
        ctx.fill();
      }
      
    }

    
  } catch (error) {
    console.error('Error in face detection:', error);
  }
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
  const S = 640;                                            // model side
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
  return { tensor, scale, dx, dy };
}


function getBestBox(
  out: Record<string, any>,
  sess: any,
  scale = 1,
  dx = 0,
  dy = 0
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

    const g=640/s;
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
  // map the box too, keeping one behaviour point
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
