

export function getMediaFilePath(mediaDir: string, fileHash: string): string {
    const FILE_SCHEME = "file://";

    if(mediaDir.startsWith(FILE_SCHEME)) {
      mediaDir = mediaDir.slice(FILE_SCHEME.length);
    }

    if (!mediaDir.endsWith('/')) {
      mediaDir += '/';
    }
    
    const subPath = fileHash
    .slice(0, 4) // "abcd"
    .split("") // ["a","b","c","d"]
    .join("/"); // "a/b/c/d"
    
    return `${FILE_SCHEME}${mediaDir}${subPath}/${fileHash}`;
}


export function boxToThumb(img: HTMLImageElement, box: number[]): string {
  const [x1, y1, x2, y2] = box;
  const w = x2 - x1, h = y2 - y1;
  const cv = document.createElement('canvas');
  cv.width = w;  cv.height = h;
  cv.getContext('2d')!.drawImage(img, x1, y1, w, h, 0, 0, w, h);
  return cv.toDataURL('image/jpeg', 0.85);   //around 2 to 4 KB
}

/** returns a synthetic <img> that holds the current video frame */
export async function snapshotVideo(video: HTMLVideoElement, pause = true): Promise<HTMLImageElement> {

  let wasPlaying = false;
  if (pause) {
    wasPlaying = !video.paused;
    if (wasPlaying) video.pause();
  }

  //copy current frame
  const cv = document.createElement('canvas');
  cv.width  = video.videoWidth;
  cv.height = video.videoHeight;
  cv.getContext('2d')!.drawImage(video, 0, 0);

  //canvas -> <img>
  const img = new Image();
  img.src = cv.toDataURL('image/png');//lossless and fast

  //resume playback if it had been paused
  if (wasPlaying) video.play();

  return img;//decode done
}

