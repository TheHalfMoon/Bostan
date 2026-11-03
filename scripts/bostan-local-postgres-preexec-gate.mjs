/**
 * Read-only, fail-closed execution gate for a freshly allocated local test PG cluster.
 * Pathname and marker alone do not authorize initdb/pg_ctl when the tree changed.
 * No filesystem operation here is an atomic lease against concurrent swaps.
 */
import { lstatSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

const REFUSAL = 'Bostan local PostgreSQL pre-execution ownership unverified; retaining fixture';
const deny = () => { throw Error(REFUSAL); };
const same = (a, b) => a.dev === b.dev && a.ino === b.ino && a.birthtimeMs === b.birthtimeMs;
const ordinary = s => s?.isDirectory?.() === true && s?.isSymbolicLink?.() === false;

export function createLocalPostgresPreExecGate({scratch, cluster, ownedScratch} = {}) {
  if (typeof scratch !== 'string' || typeof cluster !== 'string' ||
      cluster !== join(scratch, 'cluster') || typeof ownedScratch !== 'function') deny();
  let denied = false;
  let initialVerified = false;
  let initialized = null;
  const checkRoot = () => {
    try { return !denied && ownedScratch() === true; } catch { return false; }
  };
  const checkCluster = () => {
    if (!initialized) return false;
    try {
      const info = lstatSync(cluster);
      return ordinary(info) && same(info, initialized) && realpathSync(cluster) === cluster;
    } catch { return false; }
  };
  // initdb can fail after creating cluster but before afterInitdb captures its inode.
  // Such a pathname has no ownership receipt: never authorize recursive removal.
  const clusterAbsent = () => {
    try { lstatSync(cluster); return false; }
    catch (error) { return error?.code === 'ENOENT'; }
  };
  const refuse = () => { denied = true; deny(); };
  return Object.freeze({
    /** Refuse a pre-planted cluster, symlink, file, or uninspectable path. */
    beforeInitdb() {
      if (!checkRoot() || initialVerified || initialized) refuse();
      try { lstatSync(cluster); refuse(); }
      catch (error) { if (error?.code !== 'ENOENT' || denied) refuse(); }
      initialVerified = true;
      return true;
    },
    /** Bind pg_ctl to the exact new directory produced by successful initdb. */
    afterInitdb() {
      if (!initialVerified || initialized || !checkRoot()) refuse();
      try {
        const info = lstatSync(cluster);
        if (!ordinary(info) || realpathSync(cluster) !== cluster) refuse();
        initialized = {dev:info.dev, ino:info.ino, birthtimeMs:info.birthtimeMs};
      } catch { refuse(); }
      return true;
    },
    beforeStart() {
      if (!initialVerified || !checkRoot() || !checkCluster()) refuse();
      return true;
    },
    /** If compromised, never stop PG or recursively delete its pathname. */
    ownedForFinalizer() {
      return checkRoot() && (initialized ? checkCluster() : clusterAbsent());
    },
  });
}
