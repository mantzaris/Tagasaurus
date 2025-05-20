import { Readable } from 'stream';
import * as path  from 'path';
import * as fs    from 'fs/promises';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

import { FaceDet } from "../../types/face";


ffmpeg.setFfmpegPath(ffmpegPath || "");

export const SIGM = (x:number) => 1/(1+Math.exp(-x));

export function l2Normalize(v: Float32Array) {
  let sum = 0;
  for (let i = 0; i < v.length; ++i) sum += v[i] * v[i];
  const inv = 1 / Math.sqrt(sum || 1);
  for (let i = 0; i < v.length; ++i) v[i] *= inv;
}


export function nonMaxSup(faces: FaceDet[], threshold = 0.3): FaceDet[] {
    const iou = (a:number[], b:number[]) => {
      const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]);
      const x2 = Math.min(a[2], b[2]), y2 = Math.min(a[3], b[3]);
      const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
      const ua = (a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - inter;
      return inter / ua;
    };
    faces.sort((a,b)=>b.score-a.score);
    const out: FaceDet[] = [];
    faces.forEach(f => { if (out.every(o => iou(f.box,o.box) < threshold)) out.push(f); });
    return out;
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


//small 3x3 inverse
export function mathInverse(m:number[][]){
  const [a,b,c] = m[0], [d,e,f] = m[1], [g,h,i] = m[2];
  const det = a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);
  const invDet = 1/det;
  return [
    [(e*i-f*h)*invDet, (c*h-b*i)*invDet, (b*f-c*e)*invDet],
    [(f*g-d*i)*invDet, (a*i-c*g)*invDet, (c*d-a*f)*invDet],
    [(d*h-e*g)*invDet, (b*g-a*h)*invDet, (a*e-b*d)*invDet]
  ];
}

