import { app, BrowserWindow, ipcMain, Menu, MenuItemConstructorOptions } from "electron";
import electronReload from "electron-reload";
import { join } from "path";

import Database from "libsql";

import { defaultDBConfig, initTagaFolders, checkTagasaurusDirectories } from "./main-functions/initialization/init";

import { DBConfig } from "./types/dbConfig";

let mainWindow: BrowserWindow;


//INIT
initTagaFolders()
const { tagaDir, mediaDir, tempDir, dataDir } = checkTagasaurusDirectories();
const dbPath = join(dataDir,defaultDBConfig.dbName);
const db = new Database(dbPath);


app.once("ready", main);

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



ipcMain.handle("get-version", (_, key: "electron" | "node") => {
  return String(process.versions[key]);
});


setTimeout(()=>mainWindow.webContents.send("testMain1", "BAR"), 3000)
setTimeout(()=>mainWindow.webContents.send("testMain2", "BAZ"), 5000)