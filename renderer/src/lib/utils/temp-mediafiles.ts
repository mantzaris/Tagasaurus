import Dexie, { type Table } from "dexie";
import type { MediaFile } from "$lib/types/general-types";


class MediaFilesDexieDB extends Dexie {
    public newMediaFiles!: Table<MediaFile, string>;
    public sampleMediaFiles!: Table<MediaFile, string>;
  
    constructor() {
      super("MediaFilesDexieDB"); // Name of your IndexedDB database
  
      //"fileHash" is the primary key
      this.version(1).stores({
        newMediaFiles: "fileHash",      // PK
        sampleMediaFiles: "fileHash",   // PK
      });

    }
}

//singleton database object
export const localMediaFilesDB = new MediaFilesDexieDB();


//---

const MAX_SIZE = 1000;

/**
 * get all new media files
 */
export async function getNewMediaFiles(): Promise<MediaFile[]> {
  return localMediaFilesDB.newMediaFiles.toArray();
}

/**
 * add a "new media file", if fileHash already exists, skip insertion (so no duplicates)
 */
export async function addNewMediaFile(mediaFile: MediaFile): Promise<void> {
  const existing = await localMediaFilesDB.newMediaFiles.get(mediaFile.fileHash);

  if (existing) {
    return;
  }

  const totalCount = await localMediaFilesDB.newMediaFiles.count();
  if (totalCount >= MAX_SIZE) {
    const temp = await localMediaFilesDB.newMediaFiles.orderBy("fileHash").first();

    if (temp?.fileHash) {
      await localMediaFilesDB.newMediaFiles.delete(temp.fileHash);
    }
  }

  //add new item
  await localMediaFilesDB.newMediaFiles.add(mediaFile);
}

/**
 * remove one "new media file" by fileHash (PK)
 */
export async function removeNewMediaFile(fileHash: string): Promise<void> {
  await localMediaFilesDB.newMediaFiles.delete(fileHash);
}

/**
 * get all "sample media files."
 */
export async function getSampleMediaFiles(): Promise<MediaFile[]> {
  return localMediaFilesDB.sampleMediaFiles.toArray();
}

/**
 * remove one "sample media file" by fileHash (PK)
 */
export async function removeSampleMediaFile(fileHash: string): Promise<void> {
  await localMediaFilesDB.sampleMediaFiles.delete(fileHash);
}

/**
 * ensures at least `MIN_REQUIRED` sampleMediaFiles are stored
 * fetching from main if needed, and removing duplicates by fileHash
 */
export async function fillSampleMediaFiles(addRegardless = false): Promise<MediaFile[]> {
  const MIN_REQUIRED = 400;
  const currentCount = await localMediaFilesDB.sampleMediaFiles.count();

  if ( currentCount < MIN_REQUIRED || addRegardless ) {
    try {
      const newMedia: MediaFile[] = await window.bridge.requestSampleEntries();

      for (const item of newMedia) {
        const existing = await localMediaFilesDB.sampleMediaFiles.get(item.fileHash);
        
        if (!existing) {
            await localMediaFilesDB.sampleMediaFiles.put(item); //await db.sampleMediaFiles.add(item);
        }

      }
    } catch (error) {
      console.error("failed to fetch new sample entries from main:", error);
    }
  }

  //return the entire updated list
  return localMediaFilesDB.sampleMediaFiles.toArray();
}