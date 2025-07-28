
import * as tar from 'tar'; 
import { dirname, basename } from 'path';
import Database    from "libsql/promise";
import { prepareDatabaseForExport, setupWalDB } from '../db-operations/db-utils';

/**
 * Creates a gzipped tar archive of a directory
 * @param sourceDir - absolute path to the directory to be archived (eg tagaDir)
 * @param outputFilePath - absolute path where the output .tar.gz file will be saved
 */
export async function createTarArchive(db: Database, sourceDir: string, outputFilePath: string): Promise<void> {
  try {
    await prepareDatabaseForExport(db);

    const parent = dirname(sourceDir);   // .../taga/path
    const root   = basename(sourceDir);  // TagasaurusFiles

    await tar.c( // 'c' here is for create
      {
        gzip: true, 
        file: outputFilePath, // The output file path
        cwd: parent, 
      },
      [root] // Archive all files and folders in the current directory
    );
    
    console.log(`Successfully created tar archive at: ${outputFilePath}`);
  } catch (error) {
    console.error('Error creating tar archive:', error);
    //throw error;
  } finally {
    await setupWalDB(db); // always restore mode
  }
}

