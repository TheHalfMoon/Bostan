/**
 * Prepare a private per-run child profile under an already verified ephemeral
 * PostgreSQL QA scratch. Never grant real user HOME or package-manager config
 * discovery to the child. Retain scratch if an ownership check fails.
 */
import { mkdirSync, lstatSync, realpathSync } from 'node:fs';
import { join, dirname, isAbsolute, win32 } from 'node:path';

const REFUSED = 'Bostan local PostgreSQL private profile unverified; retaining fixture';
const CHILD_HOME_KEYS = new Set([
  'HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH',
  'APPDATA', 'LOCALAPPDATA', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME',
  'XDG_DATA_HOME', 'PNPM_HOME', 'COREPACK_HOME', 'TMP', 'TEMP', 'TMPDIR',
  'NPM_CONFIG_USERCONFIG', 'NPM_CONFIG_CACHE',
]);
const children = [
  'config', 'cache', 'data', 'tmp', 'pnpm', 'corepack', 'appdata',
  'appdata/roaming', 'appdata/local',
];
const same = (a,b) => a.dev === b.dev && a.ino === b.ino && a.birthtimeMs === b.birthtimeMs;
const ordinary = s => s.isDirectory() && !s.isSymbolicLink();

export function createOwnedLocalPostgresProfileEnv(ambient, {scratch, ownedScratch, platform=process.platform}={}) {
  const refuse = () => { throw Error(REFUSED); };
  if (!ambient || typeof ambient !== 'object' || Array.isArray(ambient) ||
      typeof scratch !== 'string' || !isAbsolute(scratch) ||
      typeof ownedScratch !== 'function' || !['linux','darwin','win32'].includes(platform)) refuse();
  const home = join(scratch, 'qa-home');
  if (typeof home !== 'string' || dirname(home) !== scratch) refuse();
  try { if (ownedScratch() !== true || realpathSync(scratch) !== scratch) refuse(); }
  catch { refuse(); }
  const all = [home, ...children.map(part => join(home,part))];
  const snapshots = [];
  try {
    // No recursive mkdir: every parent must be the directory just created.
    for (const p of all) {
      mkdirSync(p, {mode:0o700});
      const stat=lstatSync(p);
      if (!ordinary(stat) || realpathSync(p)!==p) refuse();
      snapshots.push({path:p,stat});
    }
  } catch { refuse(); }
  const owned=() => {
    try {
      if (ownedScratch() !== true) return false;
      for (const {path,stat} of snapshots) {
        const now=lstatSync(path);
        if (!ordinary(now) || !same(now,stat) || realpathSync(path)!==path) return false;
      }
      return true;
    } catch { return false; }
  };
  if (!owned()) refuse();
  const env=Object.create(null);
  for (const [k,v] of Object.entries(ambient)) {
    if (!CHILD_HOME_KEYS.has(k.toUpperCase()) && typeof v === 'string') env[k]=v;
  }
  Object.assign(env, {
    HOME: home,
    USERPROFILE: home,
    APPDATA: join(home,'appdata','roaming'),
    LOCALAPPDATA: join(home,'appdata','local'),
    XDG_CONFIG_HOME: join(home,'config'),
    XDG_CACHE_HOME: join(home,'cache'),
    XDG_DATA_HOME: join(home,'data'),
    COREPACK_HOME: join(home,'corepack'),
    PNPM_HOME: join(home,'pnpm'),
    NPM_CONFIG_USERCONFIG: join(home,'config','.npmrc'),
    NPM_CONFIG_CACHE: join(home,'cache'),
    COREPACK_ENABLE_NETWORK: '0',
    NPM_CONFIG_OFFLINE: 'true',
    NPM_CONFIG_UPDATE_NOTIFIER: 'false',
    TMP: join(home,'tmp'), TEMP: join(home,'tmp'), TMPDIR: join(home,'tmp'),
  });
  if (platform==='win32') {
    // Child lookup of user folders on Windows can use either the pair or
    // USERPROFILE. Keep both pointed at this same owned scratch home.
    const drive=win32.parse(home).root.slice(0,2);
    if (!/^[A-Za-z]:$/.test(drive)) refuse();
    env.HOMEDRIVE=drive;
    env.HOMEPATH=home.slice(drive.length);
  }
  return Object.freeze({ env, owned, home });
}
