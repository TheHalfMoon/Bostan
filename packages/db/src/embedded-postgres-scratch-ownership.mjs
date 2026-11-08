/**
 * Guard recursive deletion of a freshly created, test-only PostgreSQL scratch.
 * Keep the exact directory identity captured immediately after mkdtemp;
 * an identical pathname later is NOT authority to delete its contents.
 * This guard does not make concurrent replacement atomic.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REFUSAL = 'Unverified PostgreSQL test scratch directory; retaining fixture';

function within(parent, child) {
  const rel = path.relative(parent, child);
  return rel !== '' && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
}

export function captureOwnedPostgresScratchReclaimer(dir) {
  let initial, canonical, tmp;
  try {
    if (typeof dir !== 'string' || !path.isAbsolute(dir) || path.normalize(dir) !== dir)
      throw Error('not canonical');
    tmp = fs.realpathSync(os.tmpdir());
    canonical = fs.realpathSync(dir);
    initial = fs.lstatSync(dir);
    if (!within(tmp, canonical) || !initial.isDirectory() || initial.isSymbolicLink() ||
        initial.nlink < 1) throw Error('not an owned scratch');
  } catch { throw Error(REFUSAL); }
  let reclaimed = false;
  return function reclaimOwnedScratch() {
    if (reclaimed) throw Error(REFUSAL);
    let current, actual;
    try {
      current = fs.lstatSync(dir);
      actual = fs.realpathSync(dir);
    } catch { throw Error(REFUSAL); }
    if (!current.isDirectory() || current.isSymbolicLink() ||
        current.dev !== initial.dev || current.ino !== initial.ino ||
        current.birthtimeMs !== initial.birthtimeMs ||
        actual !== canonical || !within(tmp, actual)) throw Error(REFUSAL);
    // The directory is the originally captured object; never follow a linked
    // replacement. Re-checking is necessary, not a claim of race-free rm.
    fs.rmSync(dir, { recursive: true, force: false });
    reclaimed = true;
  };
}
