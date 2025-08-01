import { contextBridge, ipcRenderer, desktopCapturer, webUtils } from "electron";
import { FaceEmbedding, MediaFile } from "./types/dbConfig";
import { FaceHit, SearchRow } from "./types/variousTypes";




export const CONTEXT_BRIDGE = {

  getAssetPath: async ():Promise<string> => ipcRenderer.invoke('get-ui-assetpath'),

  onNewMedia: (callback) => {
    ipcRenderer.on("new-media", (_event, data) => {
      callback(data);
    });
  },

  getBaseDir: () => ipcRenderer.invoke('taga:get-data-dir'),

  setBaseDir: (p: string) => ipcRenderer.invoke('taga:set-data-dir', p),
  
  requestSampleEntries: async (): Promise<MediaFile[]> => {
    return await ipcRenderer.invoke("get-random-sample");
  },

  requestRandomEntries: async (count = 200): Promise<MediaFile[]> => {
    return await ipcRenderer.invoke("random-sample", count);
  },

  resetSamples: async (): Promise<void> => {
    return await ipcRenderer.invoke("reset-samples");
  },

  requestMediaDir: async () => {
    return ipcRenderer.invoke("get-media-dir");
  },

  requestSystemInfo: async () => {
    return ipcRenderer.invoke("get-system-info");
  },

  sendDroppedPaths: (paths: string[]) => {
    ipcRenderer.send('user-dropped-paths', paths);
  },

  selectFiles: (): Promise<string[]> => ipcRenderer.invoke('dialog:select-files'),

  getPathForFile: (file: File): string => webUtils.getPathForFile(file),

  exportTagasaurus: async (suggestedFileName: string, filters?: Electron.FileFilter[]): Promise<string|boolean> => {
    return ipcRenderer.invoke('dialog:select-save-path', {suggestedFileName, fileFilters: filters});
  },

  importTagasaurus: async (): Promise<boolean> => {
    return ipcRenderer.invoke('dialog:select-import-tar');
  },

  deleteMediaFile: (fileHash: string) => {
    ipcRenderer.send('delete-media-hash', fileHash);
  },

  saveMediaFileDescription: (fileHash: string, description: string, embedding: Float32Array) => {
    ipcRenderer.send('save-media-description', {fileHash, description, embedding});
  },

  searchEmbeddings: async (descrEmb: Float32Array[] = [], faceEmb: Float32Array[] = [], k: number = 100): Promise<SearchRow[]> => {
    return await ipcRenderer.invoke('search-embeddings', descrEmb, faceEmb, k);
  },

  searchFace: async (vectors: Float32Array[], k = 50): Promise<FaceHit[]> => {
    return ipcRenderer.invoke("face-search", vectors, k);
  },

  getMediaFilesByHash: async (hashes: string[]): Promise<MediaFile[]> => {
    return ipcRenderer.invoke("mediafiles-by-hash", hashes)
  },
  
  getFaceEmbeddingsById: async (ids: number[]): Promise<FaceEmbedding[]> => {
    return ipcRenderer.invoke("face-embeddings-by-media-id", ids)
  },

  saveFileByHash: async (hash: string): Promise<boolean> => {
    return await ipcRenderer.invoke('save-file-by-hash', hash);
  },

  // screens / windows
  listDesktopSources: () => ipcRenderer.invoke("request-desktop-sources"),

  // cameras / microphones
  listMediaDevices: async () => {
    const devs = await navigator.mediaDevices.enumerateDevices();    
    return devs.map(({ deviceId, kind, label }) => ({ deviceId, kind, label }));
  },


};

contextBridge.exposeInMainWorld("bridge", CONTEXT_BRIDGE);


// window.addEventListener('DOMContentLoaded', () => {
//   ipcRenderer.on('testMain1', (_event, data) => {
//     console.log('Got from main:', data);
//     // Or manipulate DOM right here
//     // document.getElementById('my-elem').innerText = data;
//   });
// });
