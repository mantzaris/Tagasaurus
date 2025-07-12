import { app, BrowserWindow, ipcMain, desktopCapturer, Menu, MenuItemConstructorOptions } from "electron";
import { once } from "node:events"; 
import electronReload from "electron-reload";

import { join } from "path";

import Database from "libsql/promise";

import { defaultDBConfig, defaultDBConfigFileQueue, initTagaFoldersAndDBSetups, checkTagasaurusDirectories } from "./main-functions/initialization/init";
import { processTempFiles } from "./main-functions/new-files/process-new-media";
import { addNewPaths } from "./main-functions/new-files/file-queue";
import { getRandomEntries } from "./main-functions/db-operations/random-entries";
import { MediaFile } from "./types/dbConfig";
import { getMediaFrontEndDirBase, saveFileByHash } from "./main-functions/utils/utils";
import { deleteMediaFileByHash } from "./main-functions/db-operations/delete";
import { getMediaFilesByHash, searchTagging } from "./main-functions/db-operations/search";
import { SearchRow } from "./types/variousTypes";

import {getDisplayServer, getIsLinux, type DisplayServer} from './main-functions/initialization/system-info'

app.commandLine.appendSwitch(
  'enable-features',
  'Vulkan,DefaultEnableUnsafeWebGPU'
);
app.commandLine.appendSwitch('enable-unsafe-webgpu');

const sampleSize = 200;
let mainWindow: BrowserWindow;
let tagaDir: string;
let mediaDir: string;
let tempDir: string;
let dataDir: string;
let created: boolean;
let db: Database;
let db_fileQueue: Database;
let dbPath: string;
let dbPath_fileQueue: string;
let sampleMediaFiles: MediaFile[];

let isLinux: boolean = false;
let displayServer: DisplayServer = null; 

//single initialization point
async function initialize() {
  const dirs = await checkTagasaurusDirectories(); //TODO: catch error
  tagaDir = dirs.tagaDir;
  mediaDir = dirs.mediaDir;
  tempDir = dirs.tempDir;
  dataDir = dirs.dataDir;
  created = dirs.created;
  
  //init databases
  dbPath = join(dataDir, defaultDBConfig.dbName);
  dbPath_fileQueue = join(dataDir, defaultDBConfigFileQueue.dbName);
  db = new Database(dbPath);
  db_fileQueue = new Database(dbPath_fileQueue);
  await db.exec(`
    PRAGMA synchronous = FULL;
    PRAGMA foreign_keys = ON;
  `);
  
  await initTagaFoldersAndDBSetups(db, db_fileQueue, created);

  isLinux = getIsLinux();
  if(isLinux) {
    displayServer = await getDisplayServer();
    if(displayServer == 'unknown') displayServer = 'wayland';
  }

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
    width: 1500,
    height: 1000,
    resizable: true,
    show: true,
    webPreferences: {
      devTools: !app.isPackaged,
      preload: join(__dirname, "preload.js"),
      webSecurity: app.isPackaged,
    }
  });

  //X11 systems
  // app.commandLine.appendSwitch("enable-usermedia-screen-capturing");
  //Wayland + PipeWire: xdg-desktop-portal plus a matching backend (xdg-desktop-portal-gnome, …-kde, …-wlr, …) are installed
  // app.commandLine.appendSwitch("enable-features","WebRTCPipeWireCapturer")

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

    if(created) {
      // await processTempFiles(db, tempDir, mediaDir, mainWindow).catch(err => 
      //   console.error("Background processing error:", err)
      // );
      await enqueueIngest(db, tempDir, mediaDir, mainWindow);
    } else {
      // processTempFiles(db, tempDir, mediaDir, mainWindow).catch(err => 
      //   console.error("Background processing error:", err)
      // );
      enqueueIngest(db, tempDir, mediaDir, mainWindow);
    }
    
    sampleMediaFiles = await getRandomEntries(db, mediaDir, sampleSize);
  } catch (error) {
    console.error("error on the app startup! :", error);
  }
});
app.on("activate", async () => {
  console.log('activate**')
  if (BrowserWindow.getAllWindows().length === 0) {
    try {
      if (!db) {
        await initialize();
      }
      if(created) {
        // await processTempFiles(db, tempDir, mediaDir, mainWindow).catch(err => 
        //   console.error("Background processing error:", err)
        // );
        await enqueueIngest(db, tempDir, mediaDir, mainWindow);
      } else {
        // processTempFiles(db, tempDir, mediaDir, mainWindow).catch(err => 
        //   console.error("Background processing error:", err)
        // );
        enqueueIngest(db, tempDir, mediaDir, mainWindow);
      }
      
      await main();
    
      sampleMediaFiles = await getRandomEntries(db, mediaDir, sampleSize);
    } catch (error) {
      console.error("error during application activate = ", error);
    }
  }
}); //macOS


ipcMain.handle("request-desktop-sources", async () => {
  if (displayServer == 'wayland') {
    return [];
  }

  const sources = await desktopCapturer.getSources({
    types: ["screen", "window"], 
    fetchWindowIcons: false, });
    return sources.map(s => ({ id: s.id, name: s.name, display_id: s.display_id })); 
});



ipcMain.on("delete-media-hash", async (event, fileHash: string) => {
  sampleMediaFiles = sampleMediaFiles.filter( mf => mf.fileHash != fileHash);

  try {
    await deleteMediaFileByHash(
      db,
      mediaDir,
      fileHash,
      defaultDBConfig
    );
  } catch (error) {
    console.error("Error deleting media file:", error);
  }

  if( sampleMediaFiles.length < Math.round(sampleSize/2) ) {
    await samplerHelper();
  }
});

async function samplerHelper() {
  sampleMediaFiles = await getRandomEntries(db, mediaDir, sampleSize);
}

ipcMain.handle("get-random-sample", async (event) => {
  if (!sampleMediaFiles || sampleMediaFiles.length === 0) {
    sampleMediaFiles = await getRandomEntries(db, mediaDir, sampleSize);
  }

  const newMedia = [...sampleMediaFiles];
  
  samplerHelper();
  return newMedia;
});

ipcMain.handle("get-media-dir", async (event) => {
  // return mediaDir;
  return getMediaFrontEndDirBase(mediaDir);
});

ipcMain.handle("get-system-info", (event) => {
  return {isLinux,displayServer}
});


ipcMain.on('save-media-description', async (_evt, p: {
  fileHash: string;
  description: string;
  embedding: Float32Array;
}) => {
  const blob = Buffer.from(p.embedding.buffer);
  const stmt = await db.prepare(`UPDATE media_files
       SET description = ?, description_embedding = ?
        WHERE file_hash   = ?`);
  await stmt.run([p.description, blob, p.fileHash]);

  const i = sampleMediaFiles.findIndex(m => m.fileHash === p.fileHash);
  if (i !== -1) {
    sampleMediaFiles[i] = {
      ...sampleMediaFiles[i],
      description:           p.description,
      descriptionEmbedding:  Array.from(p.embedding)
    };
  }
});


ipcMain.on("user-dropped-paths", async (event, filePaths: string[]) => {
  console.log("renderer dropped file/folder path:", filePaths);

  try {
    await addNewPaths(db_fileQueue, filePaths, tempDir);
    console.log("newPaths processed and copied to tempDir");

    await enqueueIngest(db, tempDir, mediaDir, mainWindow);
    // processTempFiles(db, tempDir, mediaDir, mainWindow).catch(err => 
    //   console.error("Background processing error:", err)
    // );
  } catch (error) {
    console.error("Failed to handle user-dropped paths or process them:", error);
  }
});

let ingestRunning = false;
let ingestAgain = false;

async function enqueueIngest(
  db: Database,
  tempDir: string,
  mediaDir: string,
  mainWindow: BrowserWindow
) {
  //user dropped files while an ingest is still running
  if (ingestRunning) {
    ingestAgain = true;
    return;
  }

  ingestRunning = true;
  try {
    do {
      ingestAgain = false; //reset
      await processTempFiles(db, tempDir, mediaDir, mainWindow);
      //flag was set to true, loop once more
    } while (ingestAgain);
  } finally {
    ingestRunning = false;
  }
}


ipcMain.handle("search-embeddings", async (
  event, 
  descrEmb: Float32Array[] = [] , 
  faceEmb: Float32Array[] = [],
  k: number = 100): Promise<SearchRow[]> => {
  
  return await searchTagging(db, descrEmb, faceEmb, k);
});


ipcMain.handle( "mediafiles-by-hash", async (_event, hashes: string[] = []) => {
    return getMediaFilesByHash(db, hashes);
  }
);


ipcMain.handle('save-file-by-hash', async (_evt, hash: string) => {
  const downloadsPath = app.getPath('downloads');   // renamed
  return saveFileByHash(db, hash, mediaDir, downloadsPath);
});


//allowing the gpu