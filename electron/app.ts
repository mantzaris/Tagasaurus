import { app, BrowserWindow, ipcMain, Menu, MenuItemConstructorOptions } from "electron";
import electronReload from "electron-reload";
import { join } from "path";

import Database from "libsql/promise";

import { defaultDBConfig, defaultDBConfigFileQueue, initTagaFolders, checkTagasaurusDirectories } from "./main-functions/initialization/init";
import { processTempFiles } from "./main-functions/new-files/process-new-media";
import { addNewPaths } from "./main-functions/new-files/file-queue";

let mainWindow: BrowserWindow;
let tagaDir: string;
let mediaDir: string;
let tempDir: string;
let dataDir: string;
let db: Database;
let db_fileQueue: Database;
let dbPath: string;
let dbPath_fileQueue: string;

//single initialization point
async function initialize() {
  await initTagaFolders();
  
  const dirs = await checkTagasaurusDirectories();
  tagaDir = dirs.tagaDir;
  mediaDir = dirs.mediaDir;
  tempDir = dirs.tempDir;
  dataDir = dirs.dataDir;
  
  //init databases
  dbPath = join(dataDir, defaultDBConfig.dbName);
  dbPath_fileQueue = join(dataDir, defaultDBConfigFileQueue.dbName);
  
  db = new Database(dbPath);
  db_fileQueue = new Database(dbPath_fileQueue);
  
  return { tagaDir, mediaDir, tempDir, dataDir, db, db_fileQueue };
}



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
  try {
    await initialize(); //initialize directories and DBs

    await main(); //create the BrowserWindow

    processTempFiles(db, tempDir, mediaDir, mainWindow).catch(err => 
      console.error("Background processing error:", err)
    );
  } catch (error) {
    console.error("error on the app startup! :", error)
  }
});
app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    try {
      await main();
    
      if (!db) {
        await initialize();
      }
  
      processTempFiles(db, tempDir, mediaDir, mainWindow).catch(err => 
        console.error("Background processing error:", err)
      );
    } catch (error) {
      console.error("error during application activate = ", error);
    }
  }
}); //macOS

ipcMain.on("user-dropped-paths", async (event, filePaths: string[]) => {
  console.log("renderer dropped file/folder path:", filePaths);

  try {
    await addNewPaths(db_fileQueue, filePaths, tempDir);
    console.log("newPaths processed and copied to tempDir");

    processTempFiles(db, tempDir, mediaDir, mainWindow).catch(err => 
      console.error("Background processing error:", err)
    );
  } catch (error) {
    console.error("Failed to handle user-dropped paths or process them:", error);
  }
});



ipcMain.handle("get-version", (_, key: "electron" | "node") => {
  return String(process.versions[key]);
});


// setTimeout(()=>mainWindow.webContents.send("testMain1", "BAR"), 3000)
// setTimeout(()=>mainWindow.webContents.send("testMain2", "BAZ"), 5000)

//make a handler for UI
// mainWindow.webContents.on('did-finish-load', () => {
//   processTempFiles(db, tempDir, mediaDir, mainWindow);
// });

// mainWindow.webContents.on('did-finish-load', () => {
//   console.log("about to process")
//   processTempFiles(db, tempDir, mediaDir, mainWindow);
// });