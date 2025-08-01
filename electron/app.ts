import { app, BrowserWindow, ipcMain, desktopCapturer, session, Menu, MenuItemConstructorOptions, dialog } from "electron";
import { once } from "node:events"; 
import electronReload from "electron-reload";

import { join, dirname } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync, promises as fsPromises } from 'fs';

import Database from "libsql/promise";

import { defaultDBConfig, defaultDBConfigFileQueue, initTagaFoldersAndDBSetups, checkTagasaurusDirectories } from "./main-functions/initialization/init";
import { processTempFiles } from "./main-functions/new-files/process-new-media";
import { addNewPaths } from "./main-functions/new-files/file-queue";
import { getRandomEntries } from "./main-functions/db-operations/random-entries";
import { FaceEmbedding, MediaFile } from "./types/dbConfig";
import { getMediaFrontEndDirBase, saveFileByHash } from "./main-functions/utils/utils";
import { deleteMediaFileByHash } from "./main-functions/db-operations/delete";
import { getFaceEmbeddingsByMediaIds, getMediaFilesByHash, searchFaceVectors, searchTagging } from "./main-functions/db-operations/search";
import { FaceHit, SearchRow } from "./types/variousTypes";

import {getDisplayServer, getIsLinux, getIsWindows, guessDisplaySync, type DisplayServer} from './main-functions/initialization/system-info'
import { createTarArchive } from "./main-functions/utils/export";
import { demo } from "./main-functions/utils/import";
import { ensureTagaTalk } from "./main-functions/db-operations/update";

import { pathToFileURL } from 'url';

const earlyDisplay = guessDisplaySync();

if (earlyDisplay === 'wayland') {
  app.commandLine.appendSwitch(
    'enable-features',
    'WebRTCPipeWireCapturer,UseOzonePlatform,Vulkan,DefaultEnableUnsafeWebGPU'                                     
  );
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
} else {
  app.commandLine.appendSwitch(
    'enable-features',
    'Vulkan,DefaultEnableUnsafeWebGPU'
  );
}
app.commandLine.appendSwitch('enable-unsafe-webgpu');


//SETTINGS
const SETTINGS_PATH = join(app.getPath('userData'), 'tagasaurus-settings.json');
interface Settings { tagaFilesBaseDir?: string }
function loadSettings(): Settings {
  if (existsSync(SETTINGS_PATH)) {
    try { return JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8')); } catch {}
  }
  return {};
}
function saveSettings(s: Settings) {
  writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2), 'utf-8');
}
function defaultBaseDir(): string {
  if (app.isPackaged) {
    return dirname(dirname(app.getPath('exe'))); //root sibling
  }
  let dir = __dirname;
  for (let i = 0; i < 3; i++) dir = dirname(dir); //go up levels
  // console.log(`default base dir = ${dir}`);
  return dir;
}
export const getTagaFilesBaseDir   = () => {
  const pref = loadSettings().tagaFilesBaseDir?.trim();
  // console.log(`pref = ${pref}`);
  return pref ? pref : defaultBaseDir();
};
export const setTagaFilesBaseDir = (p: string) => {
  const currentSettings = loadSettings();
  const newSettings = {
    ...currentSettings, //preserve existing settings
    tagaFilesBaseDir: p.trim() //overwrite or add the new one
  };
  saveSettings(newSettings); //save the whole object back
};
export const resetTagaFilesBaseDir = () => {
  const currentSettings = loadSettings();
  delete currentSettings.tagaFilesBaseDir; //only remove the specific key
  saveSettings(currentSettings);
};
function originalProjectRoot(): string {
  if (app.isPackaged) {
    return dirname(dirname(app.getPath('exe')));
  }
  let dir = __dirname;
  for (let i = 0; i < 3; i++) dir = dirname(dir);
  return dir;
}
export function assetsBaseDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'app', 'assets')     // packaged
    : join(originalProjectRoot(), 'Tagasaurus', 'assets');         // dev
}

ipcMain.handle('taga:get-data-dir', () => getTagaFilesBaseDir());
ipcMain.handle('taga:set-data-dir', async (_evt, dirPath: string) => {
  if (typeof dirPath !== 'string' || !dirPath.trim()) {
    throw new Error('Path must be a non‑empty string.');
  }

  // make sure the directory exists and we can write to it
  try {
    await fsPromises.access(dirPath);
  } catch {
    return false;
  }

  setTagaFilesBaseDir(dirPath.trim());

  // relaunch so every window picks up the new location
  //await initialize();
  //app.relaunch(); //spawns the new process
  app.quit(); // app.exit(0);
  return true;
});
console.log(`SETTINGS_PATH = ${SETTINGS_PATH}`);


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
let isWindows: boolean = false;

//single initialization point
async function initialize() {
  const dirs = await checkTagasaurusDirectories(); //TODO: catch error
  tagaDir = dirs.tagaDir;
  mediaDir = dirs.mediaDir;
  tempDir = dirs.tempDir;
  dataDir = dirs.dataDir;
  created = dirs.created;

  if(created) resetTagaFilesBaseDir();
  
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

  isWindows = getIsWindows();

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
      devTools: true,
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
  } else {
    //mainWindow.webContents.openDevTools({ mode: "detach" });
  }
  
  if (app.isPackaged) {
  
    // mainWindow.loadFile(join(__dirname, "../renderer/client/index.html"));
  
    const entry = pathToFileURL(join(__dirname, '../renderer/client/index.html')).href + '#/';
    mainWindow.loadURL(entry); 
    
  } else {
    electronReload(join(__dirname), {
      forceHardReset: true,
      hardResetMethod: "quit",
      electron: app.getPath("exe"),
    });

    await mainWindow.loadURL(`http://localhost:5173/`);
  }

  mainWindow.once("ready-to-show", mainWindow.show);

  if (1 || !app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: "detach" }); // dev mode
  }
}



app.once("ready", async () => {
  try {

    await initialize(); //initialize directories and DBs

    registerDisplayMediaHandler();

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

    await ensureTagaTalk(db);
    
    sampleMediaFiles = await getRandomEntries(db, mediaDir, sampleSize);

  } catch (error) {
    console.error("error on the app startup! :", error);
  }
});
app.on("activate", async () => {
  // console.log('activate**')
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

      await ensureTagaTalk(db);
      
      registerDisplayMediaHandler();

      await main();
    
      sampleMediaFiles = await getRandomEntries(db, mediaDir, sampleSize);
    } catch (error) {
      console.error("error during application activate = ", error);
    }
  }
}); //macOS


let handlerRegistered = false;
function registerDisplayMediaHandler() {
  if (handlerRegistered) return;
  handlerRegistered = true;

  session.defaultSession.setDisplayMediaRequestHandler(
    async (_req, cb) => {
      // Only called on X11 / Windows / macOS ≤ 13
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        fetchWindowIcons: false
      });

      const chosen = sources[0];            // TODO: show real modal
      if (chosen) cb({ video: chosen });
      else        cb(undefined as unknown as Electron.Streams); // user cancelled
    },
    { useSystemPicker: true }               // Wayland - skip handler
  );
}





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

ipcMain.handle("random-sample", async (event, count = sampleSize) => {
  return await getRandomEntries(db, mediaDir, count);
});

ipcMain.handle("reset-samples", async (event, count = sampleSize) => {
  sampleMediaFiles = await getRandomEntries(db, mediaDir, sampleSize);
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



ipcMain.handle('dialog:select-save-path', async (_evt, opts) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Choose where to save your export',
    defaultPath: opts.suggestedFileName,   //eg ~/Downloads/tagasaurus_backup.tar.gz
    buttonLabel: 'Save Export',
    filters: opts.fileFilters,
    properties: ['showOverwriteConfirmation'],
  });

  if (canceled || !filePath) return false;
  console.log(`filepath is: ${filePath}`)
  try {
    await createTarArchive(db, tagaDir, filePath);
    return filePath;
  } catch (err) {
    console.error('Backup failed:', err);
    return false;
  }
});




ipcMain.handle('dialog:select-files', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select media files',
    properties: ['openFile', 'multiSelections', 'dontAddToRecent']
  });
  return canceled ? [] : filePaths;
});

//TODO: windows fix !!!! xxx 'C:\\Users\\Alex\\Pictures\\jd1.jpg'
ipcMain.on("user-dropped-paths", async (event, filePaths: string[]) => {
  console.log("renderer dropped file/folder path:", filePaths);

  const raw = filePaths[0];
  console.log('inspect  :', filePaths);          // 'C:\\Users\\Alex\\Pictures\\jd1.jpg'
  console.log('template :', `${raw}`);       //  C:\Users\Alex\Pictures\jd1.jpg
  console.log('length   :', raw.length);

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


ipcMain.handle("face-embeddings-by-media-id", async (_event, mediaIds: number[] = []): Promise<FaceEmbedding[]> => {
    return getFaceEmbeddingsByMediaIds(db, mediaIds);
});


ipcMain.handle("face-search", async (
  _evt,
  queryVecs: Float32Array[],   // one or more mid‑point vectors
  k: number = 50               // top‑k per query vec
): Promise<FaceHit[]> => {
  return searchFaceVectors(db, queryVecs, k);
});


ipcMain.handle('dialog:select-import-tar', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select Tagasaurus .tar to import',
    properties: ['openFile', 'dontAddToRecent']
  });

  //console.log(`the import path:  ${filePaths[0]}`)

  if(!canceled) {
    demo(filePaths[0], db, mediaDir)
  }
});


ipcMain.handle('get-ui-assetpath', async () => {
  return app.isPackaged ? join(process.resourcesPath) : '';
});



// setTimeout(()=>demo('/home/resort/Downloads/tagasaurusExport.tar', db, mediaDir), 3000)
//allowing the gpu