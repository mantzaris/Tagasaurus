import type { MediaFile } from "$lib/types/general-types";

/**
 * Fisher-Yates (Knuth) shuffle implementation, randomizes array in place
 */
function shuffleArray<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
  

/**
 * builds a combined shuffled array of MediaFile items from 
 * newMediaFiles + sampleMediaFiles up to 'desiredCount'
 * 
 * uses ratio of (newRatio : sampleRatio) to guide the selection, e.g. 4:6
 * if one array doesn't have enough, it adapts accordingly and fills 
 * from the other if possible, result is de-duplicated by 'fileHash'
 *
 * @param newMediaFiles        array of newer items
 * @param sampleMediaFiles     array of older / sample items
 * @param desiredCount         total number of items desired
 * @param newRatio             ratio portion for 'newMediaFiles' (default 4)
 * @param sampleRatio          ratio portion for 'sampleMediaFiles' (default 6)
 * @returns                    up to 'desiredCount' MediaFile objects (possibly fewer if not enough)
 */
export function buildCombinedEntries(
  newMediaFiles: MediaFile[],
  sampleMediaFiles: MediaFile[],
  desiredCount = 10,
  newRatio = 4,
  sampleRatio = 6
): MediaFile[] {
  const shuffledNew = shuffleArray([...newMediaFiles]);
  const shuffledSample = shuffleArray([...sampleMediaFiles]);

  const totalRatio = newRatio + sampleRatio;
  let countNewDesired = Math.floor((newRatio / totalRatio) * desiredCount);
  let countSampleDesired = desiredCount - countNewDesired;

  const pickFromNew = Math.min(countNewDesired, shuffledNew.length);
  const pickFromSample = Math.min(countSampleDesired, shuffledSample.length);

  let result: MediaFile[] = [
    ...shuffledNew.slice(0, pickFromNew),
    ...shuffledSample.slice(0, pickFromSample),
  ];

  let currentCount = result.length;

  if (currentCount < desiredCount) {
    let needed = desiredCount - currentCount;
    //leftover from new
    const leftoverNewStart = pickFromNew;
    const leftoverNew = shuffledNew.slice(leftoverNewStart);

    //leftover from sample
    const leftoverSampleStart = pickFromSample;
    const leftoverSample = shuffledSample.slice(leftoverSampleStart);

    if (leftoverNew.length > 0) {
      const toAdd = leftoverNew.slice(0, needed);
      result.push(...toAdd);
      needed -= toAdd.length;
    }

    if (needed > 0 && leftoverSample.length > 0) {
      const toAdd = leftoverSample.slice(0, needed);
      result.push(...toAdd);
      needed -= toAdd.length;
    }
  }

  const seen = new Map<string, MediaFile>();
  for (const item of result) {
    seen.set(item.fileHash, item);
  }
  let uniqueResults = Array.from(seen.values());

  shuffleArray(uniqueResults);
  uniqueResults = uniqueResults.slice(0, desiredCount);

  return uniqueResults;
}
