import { contextBridge, ipcRenderer, ipcMain, webUtils } from "electron";
import { MediaFile } from "./types/dbConfig";

export const CONTEXT_BRIDGE = {

  onNewMedia: (callback) => {
    ipcRenderer.on("new-media", (_event, data) => {
      callback(data);
    });
  },
  
  requestSampleEntries: async (): Promise<MediaFile[]> => {
    return await ipcRenderer.invoke("get-random-sample");
  },

  requestMediaDir: async () => {
    return ipcRenderer.invoke("get-media-dir");
  },

  sendDroppedPaths: (paths: string[]) => {
    ipcRenderer.send('user-dropped-paths', paths);
  },

  getPathForFile: (file: File): string => webUtils.getPathForFile(file),

  deleteMediaFile: (fileHash: string) => {
    ipcRenderer.send('delete-media-hash', fileHash);
  },

  saveMediaFileDescription: (fileHash: string, description: string, embedding: Float32Array) => {
    ipcRenderer.send('save-media-description', {fileHash, description, embedding});
  },

  searchEmbeddings: async (descrEmb: Float32Array[] = [], faceEmb: Float32Array[] = [], k: number = 100) => {
    return await ipcRenderer.invoke('search-embeddings', descrEmb, faceEmb, k);
  }

};

contextBridge.exposeInMainWorld("bridge", CONTEXT_BRIDGE);


// window.addEventListener('DOMContentLoaded', () => {
//   ipcRenderer.on('testMain1', (_event, data) => {
//     console.log('Got from main:', data);
//     // Or manipulate DOM right here
//     // document.getElementById('my-elem').innerText = data;
//   });
// });
