/**
 * Resolve a fully explicit PostgreSQL QA toolchain to stable executable files.
 * PATH is intentionally NOT an authority to select a database initializer.
 * Capturing identity is not a race-free operating-system executable lease.
 */
import fs from 'node:fs';
import path from 'node:path';

export const LOCAL_PG_TOOLS = Object.freeze(['initdb','pg_ctl','createdb','psql','pg_dump','pg_restore']);
const DENIED = 'Bostan local PostgreSQL toolchain unverified; retaining fixture';
const deny = () => { throw Error(DENIED); };
const same = (a,b) => a.dev === b.dev && a.ino === b.ino && a.birthtimeMs === b.birthtimeMs;

/** binDir is an explicitly selected installed PostgreSQL bin directory. */
export function captureLocalPostgresToolchain(binDir, {platform=process.platform}={}) {
  if (!['win32','linux','darwin'].includes(platform) || typeof binDir !== 'string' ||
      !path.isAbsolute(binDir) || path.normalize(binDir) !== binDir ||
      (platform === 'win32' && !/^[A-Za-z]:\\/.test(binDir))) deny();
  const names = LOCAL_PG_TOOLS;
  const files = new Map();
  let dirIdentity;
  try {
    if (fs.realpathSync(binDir) !== binDir) deny();
    dirIdentity = fs.lstatSync(binDir);
    if (!dirIdentity.isDirectory() || dirIdentity.isSymbolicLink()) deny();
    if (platform !== 'win32' && (dirIdentity.mode & 0o022)) deny();
    for (const name of names) {
      const file = path.join(binDir, name + (platform === 'win32' ? '.exe' : ''));
      const s = fs.lstatSync(file);
      if (!s.isFile() || s.isSymbolicLink() || s.nlink !== 1 ||
          fs.realpathSync(file) !== file ||
          (platform !== 'win32' && (!(s.mode & 0o111) || (s.mode & 0o022)))) deny();
      files.set(name, {file, identity:s});
    }
  } catch { deny(); }
  return Object.freeze({
    pathFor(name) {
      if (!files.has(name)) deny();
      try {
        const dir = fs.lstatSync(binDir);
        const {file, identity} = files.get(name);
        const current = fs.lstatSync(file);
        if (!dir.isDirectory() || dir.isSymbolicLink() || !same(dirIdentity,dir) ||
            fs.realpathSync(binDir)!==binDir || !current.isFile() ||
            current.isSymbolicLink() || current.nlink!==1 || !same(identity,current) ||
            fs.realpathSync(file)!==file ||
            (platform!=='win32' && (!(current.mode & 0o111) || (current.mode & 0o022)))) deny();
        return file;
      } catch { deny(); }
    },
  });
}
