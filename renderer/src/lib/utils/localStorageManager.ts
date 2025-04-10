
/**
 * Retrieves the mediaDir from localStorage if present. If not present,
 * requests it from the main process and stores it in localStorage
 */
export async function getMediaDir(): Promise<string> {
  let dir = localStorage.getItem("mediaDir");

  if (dir) {
    return dir;
  }

  try {
      dir = await window.bridge.requestMediaDir(); //TODO: use ipc
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