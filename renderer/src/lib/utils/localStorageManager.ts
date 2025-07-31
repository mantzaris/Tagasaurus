
/**
 * Retrieves the mediaDir from localStorage if present. If not present,
 * requests it from the main process and stores it in localStorage
 */
export async function getMediaDir(): Promise<string> {
  let dir: string;

  try {
      dir = await window.bridge.requestMediaDir(); 
      if(dir) {
          localStorage.setItem("mediaDir", dir);
          return dir;
      } 

      return "";
  } catch (error) {
      console.error("Failed to fetch mediaDir from main:", error);
      return "";
  }
}


export type DisplayServer = 'wayland' | 'x11' | 'unknown' | null;

export async function getSystemInfo(): Promise<{
  isLinux: boolean;
  displayServer: DisplayServer;   
}> {
  const cachedIsLinux    = localStorage.getItem('isLinux');
  const cachedDisplayRaw = localStorage.getItem('displayServer');

  // convert the raw string (or null) to DisplayServer
  const cachedDisplay = (cachedDisplayRaw as DisplayServer) ?? null;

  if (cachedIsLinux !== null && cachedDisplay !== null) {
    return {
      isLinux: cachedIsLinux === 'true',
      displayServer: cachedDisplay   // could still be 'unknown'
    };
  }

  try {
    const { isLinux, displayServer } = await window.bridge.requestSystemInfo();

    localStorage.setItem('isLinux',        String(isLinux));
    localStorage.setItem('displayServer',  displayServer ?? ''); // store "" for null

    return { isLinux, displayServer };
  } catch (error) {
    console.error('Failed to fetch system info from main:', error);
    return { isLinux: false, displayServer: 'unknown' };
  }
}
