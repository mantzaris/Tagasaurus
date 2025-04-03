import { contextBridge, ipcRenderer, ipcMain } from "electron";

export const CONTEXT_BRIDGE = {
  /**
   * Returns the version from process.versions of the supplied target.
   */
  getVersion: async (opt: "electron" | "node"): Promise<string> => {
    return await ipcRenderer.invoke(`get-version`, opt);
  },
  testFn: () => {
    return "FOO"
  },

  onTestMain2: (callback) => {
    ipcRenderer.on("testMain2", (_event, data) => {
      callback(data);
    });
  },

  onNewMedia: (callback) => {
    ipcRenderer.on("new-media", (_event, data) => {
      callback(data);
    });
  },

  sendDroppedPaths: (paths: string[]) => {
    ipcRenderer.send('user-dropped-paths', paths);
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
