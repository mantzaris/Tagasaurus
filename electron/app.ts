import { app, BrowserWindow, ipcMain, Menu, MenuItemConstructorOptions } from "electron";
import electronReload from "electron-reload";
import { join } from "path";

import Database from "libsql";

import { defaultDBConfig, initTagaFolders, checkTagasaurusDirectories } from "./main-functions/initialization/init";
import { DBConfig } from "./types/dbConfig";
import { processTempFiles } from "./main-functions/new-files/process-new-media";

let mainWindow: BrowserWindow;


//INIT
initTagaFolders(); //create them
const { tagaDir, mediaDir, tempDir, dataDir } = checkTagasaurusDirectories(); //get the dir names
const dbPath = join(dataDir,defaultDBConfig.dbName);
const db = new Database(dbPath);



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

ipcMain.on("user-dropped-paths", (event, filePath: string) => {
  console.log("Renderer dropped file/folder path:", filePath);
  
  
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