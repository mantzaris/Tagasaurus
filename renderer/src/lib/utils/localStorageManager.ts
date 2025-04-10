//TODO: replace with indexeddb indexdb

import type { MediaFile } from "$lib/types/general-types";

export function getNewMediaFiles(): MediaFile[] {
  const stored = localStorage.getItem("newMediaFiles");
  if (!stored) return [];

  try {
      return JSON.parse(stored) as MediaFile[];
  } catch (error) {
      console.error("Error parsing newMediaFiles from localStorage:", error);
      return [];
  }
}

export function getSampleMediaFiles(): MediaFile[] {
  const stored = localStorage.getItem("sampleMediaFiles");
  if (!stored) return [];

  try {
      return JSON.parse(stored) as MediaFile[];
  } catch (error) {
      console.error("Error parsing sampleMediaFiles from localStorage:", error);
      return [];
  }
}

export function addNewMediaFile(mediaFile: MediaFile): void {
    const current = getNewMediaFiles();

    if (current.some(m => m.fileHash === mediaFile.fileHash)) {
        return;
    }

    const MAX_SIZE = 300;
    if (current.length >= MAX_SIZE) {
        current.shift(); //remove the oldest (front of the array)
    }

    current.push(mediaFile);
    localStorage.setItem("newMediaFiles", JSON.stringify(current));
}

export function removeNewMediaFile(fileHash: string): void {
  const current = getNewMediaFiles();
  
  const index = current.findIndex(m => m.fileHash === fileHash);
  if (index !== -1) {
      current.splice(index, 1);
      localStorage.setItem("newMediaFiles", JSON.stringify(current));
  }
}

export function removeSampleMediaFile(fileHash: string): void {
  const current = getSampleMediaFiles();
  
  const index = current.findIndex(m => m.fileHash === fileHash);
  if (index !== -1) {
      current.splice(index, 1);
      localStorage.setItem("sampleMediaFiles", JSON.stringify(current));
  }
}


/**
 * returns array of sample file hashes, ensuring there are 
 * at least `MIN_REQUIRED` in storage. if fewer, fetch more from main
 * store them in localStorage under "sampleMediaFiles"
 */
export async function fillSampleMediaFiles(): Promise<MediaFile[]> {
  const MIN_REQUIRED = 400;
  let stored = localStorage.getItem("sampleMediaFiles");
  let sampleMedia: MediaFile[] = stored ? JSON.parse(stored) : [];

  if (sampleMedia.length < MIN_REQUIRED) { //TODO: maybe also a random number to get new
    try {
      const newMedia: MediaFile[] = await window.bridge.requestSampleEntries(); //TODO: use ipc?
      sampleMedia = sampleMedia.concat(newMedia);  
              
      const dedupMap = new Map(sampleMedia.map(m => [m.fileHash, m]));
      sampleMedia = Array.from(dedupMap.values());

      localStorage.setItem("sampleMediaFiles", JSON.stringify(sampleMedia));
    } catch (error) {
      console.error("failed to fetch new sample entries from main:", error);
    }
  }

  return sampleMedia;
}


/**
 * Retrieves the mediaDir from localStorage if present. If not present,
 * requests it from the main process and stores it in localStorage
 */
export async function getMediaDir(): Promise<string> {
  let dir = localStorage.getItem("mediaDir");

  if (dir) {
    return dir;
  }

  try {
      dir = await window.bridge.requestMediaDir(); //TODO: use ipc
      if(dir) {
          localStorage.setItem("mediaDir", dir);
          return dir;
      }

      return "";
  } catch (error) {
      console.error("Failed to fetch mediaDir from main:", error);
      return "";
  }
}