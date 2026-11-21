import fs from "node:fs";

// Failure-only metadata from a caller-owned temporary tree. Never disclose
// names, follow links or read file contents. Retain at most the fixed entry cap.
export function installerTreeSnapshot(root) {
  const snapshot = { entries: 0, regularBytes: 0, capped: false, failed: false };
  const pending = [root];
  try {
    while (pending.length) {
      const directory = pending.pop();
      const stat = fs.lstatSync(directory, { throwIfNoEntry: false });
      if (!stat?.isDirectory() || stat.isSymbolicLink()) continue;
      const handle = fs.opendirSync(directory);
      try {
        let entry;
        while ((entry = handle.readSync()) !== null) {
          if (snapshot.entries === 4096) { snapshot.capped = true; return snapshot; }
          snapshot.entries++;
          const file = directory + "/" + entry.name;
          const info = fs.lstatSync(file);
          if (info.isSymbolicLink()) continue;
          if (info.isDirectory()) pending.push(file);
          else if (info.isFile()) snapshot.regularBytes += info.size;
        }
      } finally { handle.closeSync(); }
    }
  } catch { snapshot.failed = true; }
  return snapshot;
}
