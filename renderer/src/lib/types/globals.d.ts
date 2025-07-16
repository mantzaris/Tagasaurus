declare module 'onnxruntime-web';


import type * as VIS from 'vis-network';   // types only

declare global {
  const vis: typeof VIS;                  // runtime global’s shape
}
export {};                                // marks this file as a module
