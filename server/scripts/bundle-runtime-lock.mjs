import { randomBytes } from 'node:crypto';
import { lstat, open, readFile, unlink } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

const fail = () => new Error('Bostan compiled runtime build is locked or unsafe');

/**
 * Fail-closed, cross-process exclusive build lease covering recovery, esbuild,
 * output staging and promotion. Never automatically steal a stale lock: a
 * crashed owner needs an explicit operator check before recovery/build.
 *
 * O_EXCL creation is atomic on ordinary local NTFS/APFS/ext filesystems.
 * It is NOT a defense against hostile concurrent filesystem mutation or a
 * network filesystem with broken exclusive-create semantics.
 */
export async function withExclusiveRuntimeBuildLock({
  entry, outdir, assertSafeRuntimeOutdir, operation,
}) {
  if (typeof assertSafeRuntimeOutdir !== 'function' || typeof operation !== 'function' ||
      typeof entry !== 'string' || typeof outdir !== 'string' ||
      !isAbsolute(entry) || !isAbsolute(outdir)) throw fail();
  const canonical = await assertSafeRuntimeOutdir(entry, outdir);
  if (canonical !== resolve(outdir)) throw fail();
  const lock = join(dirname(canonical), `.bostan-${basename(canonical)}-build.lock`);
  const token = randomBytes(32).toString('hex') + '\n';
  let handle;
  try {
    handle = await open(lock, 'wx', 0o600);
  } catch (error) {
    if (error?.code === 'EEXIST' || error?.code === 'ELOOP') throw fail();
    throw error;
  }
  let owner;
  try {
    owner = await handle.stat();
    await handle.writeFile(token, 'utf8');
    return await operation(canonical);
  } finally {
    await handle.close();
    // Only unlink the exact inode and unmodified unguessable token that this
    // invocation created. If any property differs, preserve the unknown lock.
    try {
      const now = await lstat(lock);
      if (owner && now.isFile() && !now.isSymbolicLink() &&
          now.dev === owner.dev && now.ino === owner.ino &&
          now.size === Buffer.byteLength(token) &&
          await readFile(lock, 'utf8') === token) {
        await unlink(lock);
      }
    } catch {
      // Failure to release leaves a visible fail-closed lock, not an unsafe
      // implicit retry or deletion of a substituted file.
    }
  }
}
