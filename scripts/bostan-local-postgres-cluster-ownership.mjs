import { lstatSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

/** Read-only, fail-closed identity check for the exact disposable cluster path. */
export function isOwnedClusterDirectory(scratch, cluster) {
  try {
    if (typeof scratch !== 'string' || typeof cluster !== 'string') return false;
    if (cluster !== join(scratch, 'cluster')) return false;
    const root = lstatSync(scratch);
    const data = lstatSync(cluster);
    if (!root.isDirectory() || root.isSymbolicLink() ||
        !data.isDirectory() || data.isSymbolicLink()) return false;
    return realpathSync(scratch) === scratch &&
      realpathSync(cluster) === cluster;
  } catch { return false; }
}
