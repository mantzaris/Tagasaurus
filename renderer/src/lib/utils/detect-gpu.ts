import type { DeviceGPU } from "$lib/types/general-types";

export async function detectGPU():
  Promise< DeviceGPU> {

  /* ---------- 1. WebGPU ---------- */
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (adapter) return 'gpu'; //webgpu';
    } catch { /* ignore */ }
  }

  /* ---------- 2. WebGL ---------- */
  const canvas: HTMLCanvasElement | OffscreenCanvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(1, 1)
      : document.createElement('canvas');

  let gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  gl = (canvas as any).getContext?.('webgl2') ??
       (canvas as any).getContext?.('webgl');

  if (gl) {
    try {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = dbg
        ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string
        : '';

      const softwareRE = /llvmpipe|swiftshader|warp|angle|soft/i;
      if (!softwareRE.test(renderer)) {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return 'gpu';
      }
    } catch {/* fall through */}
  }

  /* ---------- 3. Fallback ---------- */
  return 'wasm';
}
