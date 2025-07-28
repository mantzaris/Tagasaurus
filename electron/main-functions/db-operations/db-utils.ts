

import Database    from "libsql/promise";
import { MediaFile } from "../../types/dbConfig";


interface MediaCursor {
  (): Promise<MediaFile | undefined>;
  close(): Promise<void>;
}


export async function makeMediaCursor(db: Database): Promise<MediaCursor> {
  // One prepared statement reused for every call.
  const stmt = await db.prepare(`
      SELECT rowid AS rid,
             id,
             file_hash   AS fileHash,
             filename,
             file_type   AS fileType,
             description,
             description_embedding AS descriptionEmbedding
        FROM media_files
       WHERE rid > ?
    ORDER BY rid
       LIMIT 1
  `);

  let lastRid = 0; // internal cursor position

  const next = (async (): Promise<MediaFile | undefined> => {
    const row = (await stmt.get([lastRid])) as
        | (MediaFile & { rid: number })
        | undefined;

    if (!row) {
      return undefined;     // reached end of table
    }

    lastRid = row.rid;  // advance cursor

    //strip rowid before returning to caller
    const { rid: _omit, ...media } = row;
    return media as MediaFile;
  }) as MediaCursor;

  //expose disposer
  next.close = async () => { stmt.free(); };

  return next;
}


