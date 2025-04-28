// SCRFD Face Detection Implementation with Proper Anchor Generation and Coordinate Transformation
// TODO: production link to extra resources:
// ort-wasm-simd.mjs              ort-wasm-simd.wasm
//ort-wasm-simd-threaded.mjs     ort-wasm-simd-threaded.wasm   (or the non-SIMD versions)


import * as onnxruntime from 'onnxruntime-web';
import * as ort from 'onnxruntime-web';


// Configuration
const MODEL_PATH = '/assets/models/scrfd10Gkps/scrfd_10g_bnkps.onnx';
const IMAGE_PATH = '/assets/images/face.jpg';
const CONF_THRESHOLD = 0.5;
const IOU_THRESHOLD = 0.4;

// SCRFD model parameters - these match the official implementation
const FEAT_STRIDES = [8, 16, 32]; // Feature pyramid network strides
const NUM_ANCHORS = 2;            // Number of anchors per point

// Type definitions
interface Detection {
  score: number;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  landmarks: Array<{x: number, y: number}>; // 5 keypoints
}

// Main function to run face detection
async function detectFaces(): Promise<void> {
  try {
    console.log("\n --------------- \n ---------------\n")
    console.log('XXXX Loading model and image...');
    
    const {canvas, image} = await imageSetup();
    const {tensor, scale, dx, dy} = preprocessImage(image);
    const session = await onnxruntime.InferenceSession.create(MODEL_PATH);
    console.log('session input names: ', session.inputNames)
    console.log('session output names: ', session.outputNames)
      
    // Run inference
    const feeds: Record<string, any> = {};
    feeds[session.inputNames[0]] = tensor;
    
    const outputData = await session.run(feeds);
    console.log('outputData = ', outputData);
    
    const { box, kps, best } = getBestBox(outputData, session);

// if you letter-boxed, map just like the box:
const toOrigX = (x:number)=> (x - dx) / scale;
const toOrigY = (y:number)=> (y - dy) / scale;
const origKps = kps.map((v,i)=> i%2 ? toOrigY(v) : toOrigX(v));

const ctx = canvas.getContext("2d"); 
/* draw box */
if(ctx) {

  ctx.strokeStyle = 'yellow';
  ctx.lineWidth   = 3;
  ctx.strokeRect(
    toOrigX(box[0]), toOrigY(box[1]),
    toOrigX(box[2]) - toOrigX(box[0]),
    toOrigY(box[3]) - toOrigY(box[1])
  );

  /* draw five cyan dots */
  ctx.fillStyle = 'cyan';
  for (let i = 0; i < 5; ++i) {
    ctx.beginPath();
    ctx.arc(origKps[2*i], origKps[2*i+1], 3, 0, Math.PI*2);
    ctx.fill();
  }

}

    
    // Process results
    //const detections = processOutputs( outputData );
    // Run face detection
    //const detections = await runFaceDetection(image);
    




    // Draw results on canvas
    //drawDetections(canvas, detections);
  } catch (error) {
    console.error('Error in face detection:', error);
  }
}

async function imageSetup() {
  // Create canvas for visualization
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  
  // Load the image
  const image = new Image();
  image.src = IMAGE_PATH;
  
  await new Promise<void>((resolve) => {
    image.onload = () => {
      console.log(`Image loaded: ${image.width}x${image.height}`);
      
      // Set canvas size to match image
      canvas.width = image.width;
      canvas.height = image.height;
      
      // Draw original image on canvas
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

// Preprocess image for the model - CRITICAL: Must match Python cv2.dnn.blobFromImage parameters
function preprocessImage(img: HTMLImageElement) {
  const S = 640;                                            // model side
  const scale = Math.min(S / img.width, S / img.height);    // keep aspect
  const nw = Math.round(img.width  * scale);
  const nh = Math.round(img.height * scale);
  const dx = 0, dy = 0;                                     // top-left paste

  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#000';                                   // black padding
  ctx.fillRect(0, 0, S, S);
  ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, nw, nh);

  /* ---- canvas (RGBA) → Float32 CHW in   B G R  order -------------- */
  const rgba = ctx.getImageData(0, 0, S, S).data;
  const chw  = new Float32Array(3 * S * S);
  const size = S * S;
  for (let i = 0; i < size; ++i) {
    const r = rgba[i*4    ];
    const g = rgba[i*4 + 1];
    const b = rgba[i*4 + 2];
    chw[i]          = (b - 127.5) / 128;   //  B   (swap!)  ←─────┐
    chw[i +   size] = (g - 127.5) / 128;   //  G              │
    chw[i + 2*size] = (r - 127.5) / 128;   //  R              └── matches
  }
  const tensor = new (onnxruntime as any).Tensor('float32', chw, [1, 3, S, S]);
  return { tensor, scale, dx, dy };
}


function getBestBox(out: Record<string, any>, sess: any) {
  const σ = (x:number)=>1/(1+Math.exp(-x));
  const strides = [8,16,32];
  let best = 0,
      box  = [0,0,0,0],
      kps  = [0,0,0,0,0,0,0,0,0,0];

  for (let i = 0; i < strides.length; ++i) {
    const s       = strides[i];
    const scores  = out[sess.outputNames[i     ]].data as Float32Array; // 0/1/2
    const deltas  = out[sess.outputNames[i + 3]].data as Float32Array; // 3/4/5
    const kpsRaw  = out[sess.outputNames[i + 6]].data as Float32Array; // 6/7/8  ★

    const g = 640 / s;
    for (let y = 0; y < g; ++y)
      for (let x = 0; x < g; ++x)
        for (let a = 0; a < 2; ++a) {
          const idx = (y*g + x)*2 + a;
          const p   = σ(scores[idx]);
          if (p <= best) continue;

          const cx = (x + 0.5) * s;
          const cy = (y + 0.5) * s;
          const o4  = idx * 4;
          const o10 = idx * 10;                    // ★  start of 5 landmarks

          const l = deltas[o4]   * s,
                t = deltas[o4+1] * s,
                r = deltas[o4+2] * s,
                b = deltas[o4+3] * s;

          best = p;
          box  = [cx - l, cy - t, cx + r, cy + b];

          /* ---------- new: decode 5 key-points ------------------- */
          for (let k = 0; k < 5; ++k) {
            kps[2*k]   = cx + kpsRaw[o10 + 2*k  ] * s;   // x
            kps[2*k+1] = cy + kpsRaw[o10 + 2*k+1] * s;   // y
          }
        }
  }
  return { box, kps, best };
}





// Apply sigmoid function to convert logits to probabilities
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// Generate anchor points for each feature level - CRITICAL: Must match Python implementation
function generateAnchors(height: number, width: number): Array<Array<[number, number]>> {
  const anchors: Array<Array<[number, number]>> = [];
  
  for (let i = 0; i < FEAT_STRIDES.length; i++) {
    const stride = FEAT_STRIDES[i];
    const featHeight = Math.ceil(height / stride);
    const featWidth = Math.ceil(width / stride);
    
    const levelAnchors: Array<[number, number]> = [];
    
    // Generate anchor points for this feature level (equivalent to np.mgrid in Python)
    for (let y = 0; y < featHeight; y++) {
      for (let x = 0; x < featWidth; x++) {
        // Anchor point coordinates (center of the cell)
        const anchorX = x;
        const anchorY = y;
        
        // Add anchor point for each anchor in this position
        for (let a = 0; a < NUM_ANCHORS; a++) {
          levelAnchors.push([anchorX, anchorY]);
        }
      }
    }
    
    anchors.push(levelAnchors);
  }
  
  return anchors;
}

// Convert distance from anchor to actual bbox coordinates - CRITICAL: Must match Python implementation
function distance2bbox(point: [number, number], distance: [number, number, number, number], stride: number): [number, number, number, number] {
  // This is the key transformation from the SCRFD paper and implementation
  // Convert distances to actual coordinates using anchor point and stride
  const x1 = point[0] * stride - distance[0] * stride;
  const y1 = point[1] * stride - distance[1] * stride;
  const x2 = point[0] * stride + distance[2] * stride;
  const y2 = point[1] * stride + distance[3] * stride;
  
  return [x1, y1, x2, y2];
}

// Convert distance from anchor to actual keypoint coordinates - CRITICAL: Must match Python implementation
function distance2kps(point: [number, number], distance: number[], stride: number): Array<{x: number, y: number}> {
  const keypoints: Array<{x: number, y: number}> = [];
  
  // Process 5 keypoints (each with x,y coordinates)
  for (let i = 0; i < 5; i++) {
    const kpx = point[0] * stride + distance[i * 2] * stride;
    const kpy = point[1] * stride + distance[i * 2 + 1] * stride;
    keypoints.push({ x: kpx, y: kpy });
  }
  
  return keypoints;
}

// Process model outputs to get detections - CRITICAL: Must match Python implementation
function processOutputs(
  outputs: Record<string, any>
) {
  console.log('Processing model outputs...');
  
  // Get output keys
  const outputKeys = Object.keys(outputs);
  console.log('Output keys:', outputKeys);
  
  // Group tensors by feature level based on their dimensions
  const featureLevels: Record<string, any[]> = {};
  
  for (const key of outputKeys) {
    const tensor = outputs[key];
    const dims = tensor.dims;
    
    // Create a key based on the second dimension (number of anchors)
    const dimKey = dims[1].toString();
    
    if (!featureLevels[dimKey]) {
      featureLevels[dimKey] = [];
    }
    
    featureLevels[dimKey].push({
      key,
      tensor,
      dims,
      size: tensor.data.length / dims[1] // Size per anchor
    });
  }
  
  const levelKeys = Object.keys(featureLevels);
  console.log('Feature levels:', levelKeys);
  
  // Generate anchors for each feature level
  const anchors = generateAnchors(640, 640);
  
  // Process each feature level
  const allDetections: Detection[] = [];
  
  for (let levelIdx = 0; levelIdx < Math.min(levelKeys.length, FEAT_STRIDES.length); levelIdx++) {
    const levelKey = levelKeys[levelIdx];
    const tensors = featureLevels[levelKey];
    const stride = FEAT_STRIDES[levelIdx];
    const levelAnchors = anchors[levelIdx];
    
    // Sort tensors by size per anchor
    // Score: 1 value per anchor
    // BBox: 4 values per anchor
    // Keypoints: 10 values per anchor (5 points x 2 coordinates)
    tensors.sort((a, b) => a.size - b.size);
    
    if (tensors.length >= 3) {
      const scoreTensor = tensors[0].tensor; // Smallest size per anchor (1)
      const bboxTensor = tensors[1].tensor;  // Medium size per anchor (4)
      const kpsTensor = tensors[2].tensor;   // Largest size per anchor (10)
      
      console.log(`Processing feature level ${levelKey} with stride ${stride}:`);
      console.log(`- Score tensor: ${tensors[0].key}, size per anchor: ${tensors[0].size}`);
      console.log(`- BBox tensor: ${tensors[1].key}, size per anchor: ${tensors[1].size}`);
      console.log(`- KPS tensor: ${tensors[2].key}, size per anchor: ${tensors[2].size}`);
      
      const scores = scoreTensor.data as Float32Array;
      const boxes = bboxTensor.data as Float32Array;
      const landmarks = kpsTensor.data as Float32Array;
      
      const numAnchorsInLevel = scoreTensor.dims[1];
      console.log(`Number of anchors in level: ${numAnchorsInLevel}`);
      
      // Process detections for this feature level
      for (let i = 0; i < numAnchorsInLevel; i++) {
        // Apply sigmoid to convert logits to probabilities
        const rawScore = scores[i];
        const score = sigmoid(rawScore);
        
        // Filter by confidence threshold
        if (score >= CONF_THRESHOLD) {
          // Get bounding box distances
          const boxOffset = i * 4;
          const boxDistances: [number, number, number, number] = [
            boxes[boxOffset],
            boxes[boxOffset + 1],
            boxes[boxOffset + 2],
            boxes[boxOffset + 3]
          ];
          
          // Get anchor point for this detection
          const anchorPoint = levelAnchors[i];
          
          // Convert distances to actual coordinates using anchor point and stride
          const bbox = distance2bbox(anchorPoint, boxDistances, stride);
          
          console.log(`Anchor point: [${anchorPoint[0]}, ${anchorPoint[1]}]`);
          console.log(`Box distances: [${boxDistances[0]}, ${boxDistances[1]}, ${boxDistances[2]}, ${boxDistances[3]}]`);
          console.log(`Box coordinates: [${bbox[0]}, ${bbox[1]}, ${bbox[2]}, ${bbox[3]}]`);
          
          // Skip invalid boxes where width or height is negative
          if (bbox[2] <= bbox[0] || bbox[3] <= bbox[1]) {
            console.log(`Skipping invalid box with negative width/height: [${bbox[0]}, ${bbox[1]}, ${bbox[2]}, ${bbox[3]}]`);
            continue;
          }
          
          // Get landmarks
          const landmarkOffset = i * 10;
          const landmarkDistances = [];
          for (let k = 0; k < 10; k++) {
            landmarkDistances.push(landmarks[landmarkOffset + k]);
          }
          
          // Convert distances to actual keypoint coordinates
          const keypoints = distance2kps(anchorPoint, landmarkDistances, stride);
          
          // Add detection
          allDetections.push({
            score,
            bbox,
            landmarks: keypoints
          });
        }
      }
    }
  }
  
  console.log(`Found ${allDetections.length} total detections before NMS`);
  
  // Map coordinates back to original image space
  // const mappedDetections = mapDetectionsToOriginalImage(
  //   allDetections,
  //   scale,
  //   paddings,
  //   originalWidth,
  //   originalHeight
  // );
  
  // // Apply non-maximum suppression
  // const finalDetections = nonMaxSuppression(mappedDetections, IOU_THRESHOLD);
  // console.log(`After NMS: ${finalDetections.length} detections`);
  
  // return finalDetections;
}

// Map detections from model space to original image space
function mapDetectionsToOriginalImage(
  detections: Detection[],
  scale: number,
  paddings: [number, number],
  originalWidth: number,
  originalHeight: number
): Detection[] {
  const [padX, padY] = paddings;
  const validDetections: Detection[] = [];
  
  for (const detection of detections) {
    // Unpack detection
    const [x1, y1, x2, y2] = detection.bbox;
    
    // Map coordinates back to original image space
    const mappedX1 = (x1 - padX) / scale;
    const mappedY1 = (y1 - padY) / scale;
    const mappedX2 = (x2 - padX) / scale;
    const mappedY2 = (y2 - padY) / scale;
    
    // Validate coordinates
    if (mappedX2 <= mappedX1 || mappedY2 <= mappedY1) {
      console.log(`Skipping detection with invalid mapped coordinates: [${mappedX1}, ${mappedY1}, ${mappedX2}, ${mappedY2}]`);
      continue;
    }
    
    // Clamp coordinates to image boundaries
    const clampedX1 = Math.max(0, mappedX1);
    const clampedY1 = Math.max(0, mappedY1);
    const clampedX2 = Math.min(originalWidth, mappedX2);
    const clampedY2 = Math.min(originalHeight, mappedY2);
    
    // Skip if box is completely outside the image or too small
    if (clampedX2 <= clampedX1 || clampedY2 <= clampedY1 || 
        clampedX2 - clampedX1 < 5 || clampedY2 - clampedY1 < 5) {
      console.log(`Skipping detection outside image or too small: [${clampedX1}, ${clampedY1}, ${clampedX2}, ${clampedY2}]`);
      continue;
    }
    
    // Map landmarks
    const mappedLandmarks = detection.landmarks.map(point => ({
      x: Math.max(0, Math.min(originalWidth, (point.x - padX) / scale)),
      y: Math.max(0, Math.min(originalHeight, (point.y - padY) / scale))
    }));
    
    // Add valid detection
    validDetections.push({
      score: detection.score,
      bbox: [clampedX1, clampedY1, clampedX2, clampedY2] as [number, number, number, number],
      landmarks: mappedLandmarks
    });
  }
  
  console.log(`Valid mapped detections: ${validDetections.length} (filtered from ${detections.length})`);
  return validDetections;
}

// Non-maximum suppression to remove overlapping detections
function nonMaxSuppression(detections: Detection[], iouThreshold: number): Detection[] {
  if (detections.length === 0) return [];
  
  // Sort by score in descending order
  const sortedDetections = [...detections].sort((a, b) => b.score - a.score);
  const selected: Detection[] = [];
  const indexes = new Set<number>();
  
  for (let i = 0; i < sortedDetections.length; i++) {
    if (indexes.has(i)) continue;
    
    selected.push(sortedDetections[i]);
    
    for (let j = i + 1; j < sortedDetections.length; j++) {
      if (indexes.has(j)) continue;
      
      const iou = calculateIoU(sortedDetections[i].bbox, sortedDetections[j].bbox);
      
      if (iou >= iouThreshold) {
        indexes.add(j);
      }
    }
  }
  
  return selected;
}

// Calculate Intersection over Union for two bounding boxes
function calculateIoU(boxA: [number, number, number, number], boxB: [number, number, number, number]): number {
  const [x1A, y1A, x2A, y2A] = boxA;
  const [x1B, y1B, x2B, y2B] = boxB;
  
  // Calculate intersection area
  const xLeft = Math.max(x1A, x1B);
  const yTop = Math.max(y1A, y1B);
  const xRight = Math.min(x2A, x2B);
  const yBottom = Math.min(y2A, y2B);
  
  if (xRight < xLeft || yBottom < yTop) return 0;
  
  const intersectionArea = (xRight - xLeft) * (yBottom - yTop);
  
  // Calculate union area
  const boxAArea = (x2A - x1A) * (y2A - y1A);
  const boxBArea = (x2B - x1B) * (y2B - y1B);
  const unionArea = boxAArea + boxBArea - intersectionArea;
  
  return intersectionArea / unionArea;
}

// Draw detections on canvas
function drawDetections(canvas: HTMLCanvasElement, detections: Detection[]): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // Colors for different landmarks
  const colors = [
    '#FF0000', // Right eye (red)
    '#00FF00', // Left eye (green)
    '#0000FF', // Nose (blue)
    '#FFFF00', // Right mouth corner (yellow)
    '#FF00FF'  // Left mouth corner (magenta)
  ];
  
  // Draw each detection
  detections.forEach((detection, index) => {
    const [x1, y1, x2, y2] = detection.bbox;
    const width = x2 - x1;
    const height = y2 - y1;
    
    // Draw bounding box
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x1, y1, width, height);
    
    // Draw detection number and score
    ctx.fillStyle = '#FFFFFF'; // White background
    ctx.fillRect(x1, y1 - 20, 80, 20);
    ctx.fillStyle = '#000000'; // Black text
    ctx.font = '12px Arial';
    ctx.fillText(`#${index + 1} (${detection.score.toFixed(2)})`, x1 + 5, y1 - 5);
    
    // Draw landmarks
    detection.landmarks.forEach((point, i) => {
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });
  });
  
  // Add legend for landmarks
  const legendItems = [
    { color: '#FF0000', label: 'Right eye' },
    { color: '#00FF00', label: 'Left eye' },
    { color: '#0000FF', label: 'Nose' },
    { color: '#FFFF00', label: 'Right mouth' },
    { color: '#FF00FF', label: 'Left mouth' }
  ];
  
  const legendX = 10;
  let legendY = 20;
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillRect(legendX - 5, legendY - 15, 120, 110);
  
  legendItems.forEach(item => {
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(legendX, legendY, 5, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.fillStyle = '#000000';
    ctx.font = '12px Arial';
    ctx.fillText(item.label, legendX + 10, legendY + 4);
    
    legendY += 20;
  });
}



// Auto-run detection when script is loaded
detectFaces().catch(error => {
  console.error('Error in face detection:', error);
});
