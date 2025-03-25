
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { app } from "electron";


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
 */
export function checkTagasaurusFiles(): {
    tagaDir: string;
    mediaDir: string;
    dataDir: string;
  } {
    let baseDir: string;
  
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
      console.log(`Created: ${tagaDir}`);
    } else {
      console.log(`Already exists: ${tagaDir}`);
    }
  
    const mediaDir = join(tagaDir, "MediaFiles");
    if (!existsSync(mediaDir)) {
      mkdirSync(mediaDir);
      console.log(`Created: ${mediaDir}`);
    }
  
    const dataDir = join(tagaDir, "Data");
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir);
      console.log(`Created: ${dataDir}`);
    }
  
    return { tagaDir, mediaDir, dataDir };
  }