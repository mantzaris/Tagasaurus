import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';

const execAsync = promisify(execFile);
export type DisplayServer = 'wayland' | 'x11' | 'unknown' | null;


export const getIsLinux = (): boolean => process.platform === 'linux';
export const getIsWindows = (): boolean => process.platform === "win32";


//run a command with a short timeout; true on exit-code 0
async function canRun(cmd: string, args: string[] = [], timeout = 500): Promise<boolean> {
  try {
    await execAsync(cmd, args, { timeout });
    return true;
  } catch { return false; }
}

//quick tests
export const guessDisplaySync = (): DisplayServer => {
  if (!getIsLinux()) return 'unknown';

  const env = process.env;
  if (env.WAYLAND_DISPLAY)                        return 'wayland';

  const sess = env.XDG_SESSION_TYPE?.toLowerCase();
  if (sess === 'wayland')                         return 'wayland';
  if (env.DISPLAY)                                return 'x11';
  if (sess === 'x11')                             return 'x11';

  return 'unknown';
};


//definitive async probe  (memoised)
let cached: DisplayServer | undefined;

//re-probe only if `refresh=true`: otherwise returns cached value
export async function getDisplayServer(refresh = false): Promise<DisplayServer> {
  if (!refresh && cached !== undefined) return cached;
  if (!getIsLinux())                        return (cached = 'unknown');

  //cheap env-var exit
  const early = guessDisplaySync();
  if (early !== 'unknown') return (cached = early);

  const env = process.env;

  //headless / container sentinel
  if (!env.DISPLAY && !env.WAYLAND_DISPLAY && !env.XDG_SESSION_TYPE) {
    return (cached = 'unknown');
  }

  //probe native X11 (faster than xdpyinfo)
  if (await canRun('xset', ['-q'])) return (cached = 'x11');

  //systemd-logind query (if available)
  if (await canRun('loginctl', ['--help'])) {
    try {
      const { stdout: list } = await execAsync('loginctl', [], { timeout: 500 });
      const sessions = list
        .split('\n')
        .filter(l => l.includes(` ${env.USER} `))
        .map(l => l.trim().split(/\s+/));               // [id, seat, user, state, ...]

      //prefer an 'active' GUI session if present
      const pick = sessions.find(s => s[3] === 'active' || s[4] === 'active') ?? sessions[0];
      const sid  = pick?.[0];

      if (sid) {
        const { stdout } = await execAsync(
          'loginctl', ['show-session', sid, '-p', 'Type'], { timeout: 500 });
        const t = stdout.split('=')[1]?.trim().toLowerCase();
        if (t === 'wayland' || t === 'x11') return (cached = t as DisplayServer);
      }
    } catch { /* ignore */ }
  }

  //heuristic: Xwayland vs pure Wayland
  if (env.WAYLAND_DISPLAY) {
    if (await looksLikeXwayland()) return (cached = 'x11');
    return (cached = 'wayland');
  }

  return (cached = 'unknown');
}

//Xwayland heuristic
async function looksLikeXwayland(): Promise<boolean> {
  // scan /proc for our UID, capped to 250 pids for safety
  try {
    const pids = await fs.readdir('/proc');
    let examined = 0;

    for (const pid of pids) {
      if (!/^\d+$/.test(pid)) continue;
      if (++examined > 250) break; // defensive cap

      const uid = await fs.readFile(`/proc/${pid}/loginuid`, 'utf8').catch(() => '');
      if (+uid !== process.getuid()) continue;

      const cmd = await fs.readFile(path.join('/proc', pid, 'cmdline'), 'utf8').catch(() => '');
      if (cmd.includes('Xwayland')) return true;
    }
  } catch { /* /proc may be restricted: fall through */ }

  //fallback: ps list (works even if /proc limited)
  try {
    const { stdout } = await execAsync('ps', ['-u', String(process.getuid())], { timeout: 500 });
    if (stdout.includes('Xwayland')) return true;
  } catch { /* ignore */ }

  return false;
}
