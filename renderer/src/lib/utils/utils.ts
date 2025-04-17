

export function getMediaFilePath(mediaDir: string, fileHash: string): string {
    const FILE_SCHEME = "file://";

    if(mediaDir.startsWith(FILE_SCHEME)) {
      mediaDir = mediaDir.slice(FILE_SCHEME.length);
    }

    if (!mediaDir.endsWith('/')) {
      mediaDir += '/';
    }
    
    const subPath = fileHash
    .slice(0, 4) // "abcd"
    .split("") // ["a","b","c","d"]
    .join("/"); // "a/b/c/d"
    
    return `${FILE_SCHEME}${mediaDir}${subPath}/${fileHash}`;
}
