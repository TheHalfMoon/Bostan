import { lstatSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

/** Read-only identity check; missing cluster is allowed only before any start attempt. */
export function isOwnedClusterDirectory(scratch, cluster, {allowMissing = false} = {}) {
  try {
    if (typeof scratch !== 'string' || typeof cluster !== 'string') return false;
    if (cluster !== join(scratch, 'cluster')) return false;
    const root = lstatSync(scratch);
    if (!root.isDirectory() || root.isSymbolicLink() || realpathSync(scratch) !== scratch) return false;
    let data;
    try { data = lstatSync(cluster); }
    catch (error) { return allowMissing === true && error?.code === 'ENOENT'; }
    return data.isDirectory() && !data.isSymbolicLink() && realpathSync(cluster) === cluster;
  } catch { return false; }
}
