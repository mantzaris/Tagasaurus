export function getMediaFilePath(mediaDir: string, fileHash: string): string {
    
    const firstFour = fileHash.slice(0, 4); // e.g. "abcd"
    const subfolders = firstFour.split('');
    const subPath = subfolders.join('/');
    
    return `${mediaDir}/${subPath}/${fileHash}`;
  }
  