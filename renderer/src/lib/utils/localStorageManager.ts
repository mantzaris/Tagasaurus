
export function getNewFileHashes(): string[] {
    const stored = localStorage.getItem("newHashes");

    if (!stored) return [];

    try {
        return JSON.parse(stored) as string[];
    } catch (error) {
        console.error("Error parsing newHashes from localStorage:", error);
        return [];
    }
}
  
export function addNewFileHash(hash: string): void {
    const current = getNewFileHashes();
    if (!current.includes(hash)) {
      current.push(hash);
      localStorage.setItem("newHashes", JSON.stringify(current));
    }
}
  
export function removeNewFileHash(hash: string): void {
    const current = getNewFileHashes();
    const index = current.indexOf(hash);
    if (index !== -1) {
      current.splice(index, 1);
      localStorage.setItem("newHashes", JSON.stringify(current));
    }
}