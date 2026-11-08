/**
 * Bostan test-only ownership receipt for a newly created PostgreSQL scratch.
 * A pathname and copyable marker text alone do not authorize recursive removal.
 * This is not an atomic guarantee against privileged concurrent replacement.
 */
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, normalize, relative, sep } from 'node:path';

function inside(parent, child) {
  const rel = relative(parent, child);
  return rel !== '' && rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel);
}
function sameIdentity(first, next) {
  return first.dev === next.dev && first.ino === next.ino &&
    first.birthtimeMs === next.birthtimeMs;
}
const ordinaryDirectory = s => s.isDirectory() && !s.isSymbolicLink();
const ordinaryMarker = s => s.isFile() && !s.isSymbolicLink() && s.nlink === 1;

/** Capture once immediately after mkdtemp and writing the owned marker. */
export function captureOwnedLocalPostgresScratch({ scratch, marker, markerText } = {}) {
  const refused = () => { throw Error('Bostan local PostgreSQL scratch identity unverified; retaining fixture'); };
  if (typeof scratch !== 'string' || !isAbsolute(scratch) || normalize(scratch) !== scratch ||
      !/^bostan-pg-qualification-[A-Za-z0-9_-]{6,80}$/.test(basename(scratch)) ||
      typeof marker !== 'string' || marker !== join(scratch, 'BOSTAN_OWNED_DISPOSABLE_CLUSTER') ||
      typeof markerText !== 'string' || markerText.length < 8 || markerText.length > 256)
    refused();
  let root, proof, canonicalScratch, canonicalMarker, canonicalTemp;
  try {
    root = lstatSync(scratch);
    proof = lstatSync(marker);
    canonicalScratch = realpathSync(scratch);
    canonicalMarker = realpathSync(marker);
    canonicalTemp = realpathSync(tmpdir());
    if (!ordinaryDirectory(root) || !ordinaryMarker(proof) ||
        canonicalScratch !== scratch || canonicalMarker !== marker ||
        dirname(canonicalMarker) !== canonicalScratch ||
        !inside(canonicalTemp, canonicalScratch) ||
        proof.size !== Buffer.byteLength(markerText) || readFileSync(marker, 'utf8') !== markerText)
      refused();
  } catch { refused(); }
  return function isOriginalOwnedScratch() {
    try {
      const currentRoot = lstatSync(scratch);
      const currentProof = lstatSync(marker);
      return ordinaryDirectory(currentRoot) && sameIdentity(root, currentRoot) &&
        ordinaryMarker(currentProof) && sameIdentity(proof, currentProof) &&
        currentProof.size === proof.size &&
        realpathSync(scratch) === canonicalScratch &&
        realpathSync(marker) === canonicalMarker &&
        readFileSync(marker, 'utf8') === markerText;
    } catch { return false; }
  };
}
