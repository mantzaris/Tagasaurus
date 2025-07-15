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
const MAX_SIZE = 10000;


export async function clearSessionMediaCache(): Promise<void> {
  await localMediaFilesDB.delete();   // drops the entire IndexedDB database
  await localMediaFilesDB.open();     // recreates it so the singleton keeps working
}


/**
 * getMediaFile - returns a MediaFile by its fileHash from either newMediaFiles or sampleMediaFiles
 *
 * @param fileHash - unique hash identifier of the MediaFile
 * @param removeAfter - boolean flag, if true, the found media file will be removed from its store
 * @returns promise that resolves to the found MediaFile or undefined if not found
 */
export async function getMediaFile(
  fileHash: string,
  removeAfter: boolean = false
): Promise<MediaFile | undefined> {
  let mediaFile: MediaFile | undefined;

  mediaFile = await localMediaFilesDB.newMediaFiles.get(fileHash);

  if (mediaFile) {
    if (removeAfter) {
      await localMediaFilesDB.newMediaFiles.delete(fileHash);
    }

    void fillSampleMediaFiles();//fire and 4'get
    return mediaFile;
  }

  mediaFile = await localMediaFilesDB.sampleMediaFiles.get(fileHash);
  if (mediaFile) { 
    if (removeAfter) { 
      await localMediaFilesDB.sampleMediaFiles.delete(fileHash);
    }

    void fillSampleMediaFiles();//fire and 4'get
    return mediaFile;
  }

  void fillSampleMediaFiles();//fire and 4'get
  return undefined;
}



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

  //put overwrites and no error, add new item will cause an error if duplicate
  await localMediaFilesDB.newMediaFiles.put(mediaFile);
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
export async function fillSampleMediaFiles(): Promise<MediaFile[]> {
  const MIN_REQUIRED = 400;
  const currentCount = await localMediaFilesDB.sampleMediaFiles.count();

  if ( currentCount < MIN_REQUIRED ) {
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

/**
 * removeMediaFileSequential - Removes a media file by first checking which table contains it
 *
 * @param fileHash - unique hash identifier of the MediaFile
 * @returns Promise<void>
 */
export async function removeMediaFileSequential(fileHash: string): Promise<void> {
  // Attempt to remove from newMediaFiles
  await localMediaFilesDB.newMediaFiles.delete(fileHash);
  
  // Attempt to remove from sampleMediaFiles
  await localMediaFilesDB.sampleMediaFiles.delete(fileHash);
}


/**
 * getRandomNewMediaFile - samples random media file from the newMediaFiles collection
 *
 * @param removeAfter - if true, the found media file is removed from newMediaFiles
 * @returns promise resolving to a MediaFile or undefined if the collection is empty
 */
export async function getRandomNewMediaFile(removeAfter: boolean = false): Promise<MediaFile | undefined> {
  const count = await localMediaFilesDB.newMediaFiles.count();
  if (count === 0) {
    void fillSampleMediaFiles();
    return undefined;
  }

  const randIndex = Math.floor(Math.random() * count);
  // 'orderBy("fileHash")' is fine if fileHash is the PK or an indexed key
  const mediaFile = await localMediaFilesDB.newMediaFiles
    .orderBy("fileHash")
    .offset(randIndex)
    .first();

  if (mediaFile && removeAfter) {
    await removeMediaFileSequential(mediaFile.fileHash);
  }

  void fillSampleMediaFiles(); // Fire-and-forget to ensure sampleMediaFiles is always replenished
  return mediaFile;
}

/**
 * Returns the counts for both newMediaFiles and sampleMediaFiles collections.
 *
 * @returns A Promise resolving to an object containing counts for both collections.
 */
export async function getCombinedCounts(): Promise<{ newMediaFiles: number; sampleMediaFiles: number }> {
  const [newCount, sampleCount] = await Promise.all([
    localMediaFilesDB.newMediaFiles.count(),
    localMediaFilesDB.sampleMediaFiles.count()
  ]);
  return { newMediaFiles: newCount, sampleMediaFiles: sampleCount };
}

/**
 * Returns the total number of media files from both newMediaFiles and sampleMediaFiles.
 *
 * @returns A Promise resolving to the total count (sum) of media files.
 */
export async function getTotalMediaFileCount(): Promise<number> {
  // Fetch counts concurrently for both collections
  const [newCount, sampleCount] = await Promise.all([
    localMediaFilesDB.newMediaFiles.count(),
    localMediaFilesDB.sampleMediaFiles.count()
  ]);

  // Return the sum of both counts
  return newCount + sampleCount;
}


/**
 * getRandomSampleMediaFile - samples random media file from the sampleMediaFiles collection
 *
 * @param removeAfter - if true, the found media file is removed from sampleMediaFiles
 * @returns promise resolving to a MediaFile or undefined if the collection is empty
 */
export async function getRandomSampleMediaFile(removeAfter: boolean = false): Promise<MediaFile | undefined> {
  const count = await localMediaFilesDB.sampleMediaFiles.count();
  if (count === 0) {
    void fillSampleMediaFiles();
    return undefined;
  }

  const randIndex = Math.floor(Math.random() * count);
  const mediaFile = await localMediaFilesDB.sampleMediaFiles
    .orderBy("fileHash")
    .offset(randIndex)
    .first();

  if (mediaFile && removeAfter) {
    await removeMediaFileSequential(mediaFile.fileHash);
  }

  void fillSampleMediaFiles();
  return mediaFile;
}

/**
 * getRandomMediaFile - returns a media file chosen randomly from one or the other collection
 *
 * starts by randomly selecting which collection to try first and if the selected collection is empty,
 * it falls back to the other. The removeAfter parameter is passed along so that the media file is deleted
 * from whichever collection it originates from if set to true
 *
 * @param removeAfter - Boolean indicating whether to delete the media file after retrieval
 * @returns promise resolving to a MediaFile or undefined if no media files exist
 */
export async function getRandomMediaFile(removeAfter: boolean = false): Promise<MediaFile | undefined> {
  // Randomly choose which collection to try first (50/50 chance).
  const chooseNewFirst = Math.random() < 0.5;
  let mediaFile: MediaFile | undefined;

  if (chooseNewFirst) {
    // Try sampling from newMediaFiles first.
    mediaFile = await getRandomNewMediaFile(removeAfter);
    // If no file was found, try sampleMediaFiles.
    if (!mediaFile) {
      mediaFile = await getRandomSampleMediaFile(removeAfter);
    }
  } else {
    // Try sampling from sampleMediaFiles first.
    mediaFile = await getRandomSampleMediaFile(removeAfter);
    if (!mediaFile) {
      mediaFile = await getRandomNewMediaFile(removeAfter);
    }
  }
  void fillSampleMediaFiles();
  return mediaFile;
}
