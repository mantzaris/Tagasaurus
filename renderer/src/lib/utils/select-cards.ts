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
 * combines up to 'desiredCount' entries from newMediaFiles + sampleMediaFiles 
 * in a 4:6 priority but picks them randomly each time
 * 
 * Steps:
 *   shuffle newMediaFiles & sampleMediaFiles so we pick random elements
 *   take up to 4 from newMediaFiles
 *   take up to (desiredCount - result.length) from sampleMediaFiles
 *   if still under desiredCount, take more from newMediaFiles
 *   shuffle the final combined result so the order is also random
 *
 * returns an array of up to 'desiredCount' MediaFile objects (could be fewer if not enough)
 */
export function buildCombinedEntries(
    newMediaFiles: MediaFile[],
    sampleMediaFiles: MediaFile[],
    desiredCount = 10
  ): MediaFile[] {
    
    const shuffledNew = shuffleArray([...newMediaFiles]);     // MediaFile[]
    const shuffledSample = shuffleArray([...sampleMediaFiles]); // MediaFile[]
  
    const result: MediaFile[] = [];
  
    const portionFromNew = shuffledNew.slice(0, 4); 
    result.push(...portionFromNew);
  
    let needed = desiredCount - result.length;
    if (needed > 0) {
      const portionFromSample = shuffledSample.slice(0, needed);
      result.push(...portionFromSample);
    }
  
    needed = desiredCount - result.length;
    if (needed > 0) {
      const leftoverNew = shuffledNew.slice(4); 
      const leftoverPortionFromNew = leftoverNew.slice(0, needed);
      result.push(...leftoverPortionFromNew);
    }
  
    shuffleArray(result);
  
    const dedupMap = new Map<string, MediaFile>();
    for (const item of result) {
        dedupMap.set(item.fileHash, item);
    }

    //map back to an array, shuffle again if you want a final random order
    let uniqueResults = Array.from(dedupMap.values());
    shuffleArray(uniqueResults);

    //return up to desiredCount
    uniqueResults = uniqueResults.slice(0, desiredCount);

    return uniqueResults;
  }
  