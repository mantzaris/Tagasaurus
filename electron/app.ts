import { app, BrowserWindow, ipcMain, Menu, MenuItemConstructorOptions } from "electron";
import electronReload from "electron-reload";
import { join } from "path";

import Database from "libsql"; //TODO: use "libsql/promises"


import { defaultDBConfig, defaultDBConfigFileQueue, initTagaFolders, checkTagasaurusDirectories } from "./main-functions/initialization/init";
import { processTempFiles } from "./main-functions/new-files/process-new-media";
import { addNewPaths } from "./main-functions/new-files/file-queue";

let mainWindow: BrowserWindow;


//INIT
initTagaFolders(); //create them
const { tagaDir, mediaDir, tempDir, dataDir } = checkTagasaurusDirectories(); //get the dir names

const dbPath = join(dataDir,defaultDBConfig.dbName);
const db = new Database(dbPath);

const dbPath_fileQueue = join(dataDir,defaultDBConfigFileQueue.dbName);
const db_fileQueue = new Database(dbPath_fileQueue);


async function main() {
  
  const minimalMenuTemplate: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }
  ];
  
  if (process.platform === 'darwin') {
    const minimalMenu = Menu.buildFromTemplate(minimalMenuTemplate);
    Menu.setApplicationMenu(minimalMenu);
  } else {
    Menu.setApplicationMenu(null);
  }
  
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    resizable: true,
    show: true,
    webPreferences: {
      devTools: !app.isPackaged,
      preload: join(__dirname, "preload.js"),
    },
  });

  if(!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
  
  if (app.isPackaged) {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  } else {
    electronReload(join(__dirname), {
      forceHardReset: true,
      hardResetMethod: "quit",
      electron: app.getPath("exe"),
    });

    await mainWindow.loadURL(`http://localhost:5173/`);
  }

  mainWindow.once("ready-to-show", mainWindow.show);
}


app.once("ready", async () => {
  await main()
  processTempFiles(db, tempDir, mediaDir, mainWindow);
});
app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await main();
    processTempFiles(db, tempDir, mediaDir, mainWindow);
  }
}); //macOS

ipcMain.on("user-dropped-paths", (event, filePaths: string[]) => {
  console.log("Renderer dropped file/folder path:", filePaths);

  //fire and forget
  addNewPaths(db_fileQueue, filePaths, tempDir)
  .then(() => {
    console.log("done inserting paths");
  })
  .catch((error) => {
    console.error("failed to add new paths:", error);
  });

});



ipcMain.handle("get-version", (_, key: "electron" | "node") => {
  return String(process.versions[key]);
});


setTimeout(()=>mainWindow.webContents.send("testMain1", "BAR"), 3000)
setTimeout(()=>mainWindow.webContents.send("testMain2", "BAZ"), 5000)

//make a handler for UI
// mainWindow.webContents.on('did-finish-load', () => {
//   processTempFiles(db, tempDir, mediaDir, mainWindow);
// });

// mainWindow.webContents.on('did-finish-load', () => {
//   console.log("about to process")
//   processTempFiles(db, tempDir, mediaDir, mainWindow);
// });