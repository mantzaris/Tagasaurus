
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { app } from "electron";
import fsExtra from "fs-extra";


export function startTagaInit() {
    const { tagaDir, mediaDir, tempDir, dataDir, created } = checkTagasaurusFiles();
    console.log("TagasaurusFiles Directory:", tagaDir);
    
    if(created) {
        copyInitMediaToTemp(tempDir).catch((error) => {
            console.error("Error copying init media to TempFiles:", error);
        });
    }

}
/**
 * Ensures a sibling directory `TagasaurusFiles` is created beside your main
 * `Tagasaurus` folder, then creates two subdirectories: `MediaFiles` and `Data`.
 *
 * In packaged mode:
 * - Uses `app.getPath("exe")` to locate the executable,
 *   goes one level up, and places `TagasaurusFiles` there.
 *
 * In dev mode:
 * - Moves up from `__dirname` enough times to reach the parent folder of 
 *   `Tagasaurus/`, and creates the `TagasaurusFiles` folder there.
 *
 * @returns {TagasaurusPaths} An object with the absolute paths to:
 *  - `tagaDir`:     The main TagasaurusFiles directory
 *  - `mediaDir`:    The MediaFiles subfolder
 *  - `dataDir`:     The Data subfolder
 *  - `tempDir`:     The Temporary data folder
 *  - `created`:     Boolean for if the directory needed to be created or not
 */
function checkTagasaurusFiles(): {
    tagaDir: string;
    mediaDir: string;
    tempDir: string;
    dataDir: string;
    created: boolean;
  } {
    let baseDir: string;
    let created = false;
  
    if (app.isPackaged) {      
      const exeDir = dirname(app.getPath("exe"));
      baseDir = dirname(exeDir);
    } else {  
      const upOnce = dirname(__dirname);
      const upTwice = dirname(upOnce);
      const upThrice = dirname(upTwice); 
      const upFour   = dirname(upThrice);
      const upFive   = dirname(upFour);
      baseDir = upFive;
    }
  
    const tagaDir = join(baseDir, "TagasaurusFiles");
  
    if (!existsSync(tagaDir)) {
      mkdirSync(tagaDir);
      created = true;
      console.log(`Created: ${tagaDir}`);
    } else {
      console.log(`Already exists: ${tagaDir}`);
    }
  
    const mediaDir = join(tagaDir, "MediaFiles");
    if (!existsSync(mediaDir)) {
      mkdirSync(mediaDir);
      console.log(`Created: ${mediaDir}`);
    }

    const tempDir = join(tagaDir, "TempFiles");
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir);
      console.log(`Created: ${tempDir}`);
    }
  
    const dataDir = join(tagaDir, "Data");
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir);
      console.log(`Created: ${dataDir}`);
    }
  
    return { tagaDir, mediaDir, tempDir, dataDir, created };
  }


/**
 * Copies all files from `assets/init-media` into the specified `dest` folder.
 * In dev mode, it references a relative path from __dirname.
 * In production mode, it references a folder under process.resourcesPath (or app.getAppPath()).
 *
 * @param dest - The absolute path where files will be copied (e.g. `TempFiles`).
 */
async function copyInitMediaToTemp(dest: string): Promise<void> {
    let initMediaPath: string;

    if (app.isPackaged) {
        initMediaPath = join(process.resourcesPath, "assets", "init-media");
        // alternative: initMediaPath = join(app.getAppPath(), "assets", "init-media");
    } else {
        initMediaPath = join(__dirname, "..", "..", "..", "..", "assets", "init-media");
    }

    try {
        await fsExtra.copy(initMediaPath, dest);
        console.log(`Copied init-media folder from "${initMediaPath}" to "${dest}"`);
    } catch (error) {
        console.error("Failed to copy init-media:", error);
    }
}