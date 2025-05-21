import * as path  from 'path';
import * as fs    from 'fs/promises';


import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

ffmpeg.setFfmpegPath(ffmpegPath || "");


export async function videoDurationSec(file: string): Promise<number> {
  return new Promise((res, rej) => {
    ffmpeg.ffprobe(file, (err, meta) => {
      if (err) return rej(err);
      const secs = meta.format.duration ?? 0;
      res(secs);
    });
  });
}


export async function extractVideoFrame(
  filePath: string,
  tSec    : number,
  codec   : 'png' | 'mjpeg' = 'png'
): Promise<Buffer | null> {

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const command = ffmpeg(filePath)
      .seekInput(tSec)                              // fast seek
      .outputOptions('-frames:v', '1',
                     '-f',        'image2pipe',
                     '-vcodec',    codec,
                     '-loglevel', 'error')
      .on('error', (err) => {                       // ① kill on error
        command.kill('SIGKILL');
        reject(err);
      })
      .on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve(buf.length ? buf : null);
      });

    command.pipe()
      .on('data', c => chunks.push(c))
      .on('error', e => {                           // ② kill here too
        command.kill('SIGKILL');
        reject(e);
      });
  });
}

// export async function extractVideoFrame(filePath: string, tSec: number, codec: 'png' | 'mjpeg' = 'png'): Promise<Buffer | null> {
//     return new Promise((resolve, reject) => {
//       const chunks: Buffer[] = [];
//       console.log(`[ffmpeg] Starting frame extraction for ${filePath} at ${tSec}s.`);
  
//       const command = ffmpeg(filePath)
//         .seekInput(tSec)
//         .outputOptions([
//           '-frames:v', '1',
//           '-f',        'image2pipe',
//           '-vcodec',   codec
//         ])
//         .on("start", function(commandLine) {
//           console.log("[ffmpeg] Spawned Ffmpeg with command: " + commandLine);
//         })
//         .on("error", (err, stdout, stderr) => {
//           console.error("[ffmpeg] Error: " + err.message);
//           if (stdout) {
//               console.error("[ffmpeg] stdout: " + stdout);
//           }
//           if (stderr) {
//               console.error("[ffmpeg] stderr: " + stderr);
//           }
//           reject(err);
//         })
//         .on("end", () => {
//           console.log(`[ffmpeg] frame size ${chunks.reduce((n,c)=>n+c.length,0)} bytes`);
//           if (chunks.length === 0) {
//               console.warn("[ffmpeg] No data chunks received. Output buffer will be empty.");
//           }
//           const buf = Buffer.concat(chunks);
//           resolve(buf.length ? buf : null);
//         });
  
//       const stream = command.pipe();
  
//       stream.on("data", (chunk) => {
//         // console.log(`[stream] Received chunk of size: ${chunk.length}`);
//         chunks.push(chunk);
//       });
  
//       stream.on("error", (err) => {
//           console.error("[stream] Stream error: " + err.message);
//           reject(err);
//       });
  
//       stream.on("end", () => { // This end event is for the stream itself, ffmpeg "end" is handled above
//           console.log("[stream] Stream ended.");
//       });
//     });
// }


export function chooseTimes(duration: number, stepSec = 1): number[] {
  const wanted = Math.floor( duration / stepSec);
  const times: number[] = [];
  for (let i = 0; i < wanted; ++i) times.push(i * stepSec);
  return times;
}
