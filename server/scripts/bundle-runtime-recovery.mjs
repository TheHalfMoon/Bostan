import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, rename } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

const MARKER = '.bostan-compiled-runtime-owner.json';
const SCHEMA = 'bostan.compiled-runtime-owner.v1';
const MAX_FILES = 10_000;
const MAX_MARKER_BYTES = 1_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const generated = name => typeof name === 'string' && basename(name) === name &&
  /^[a-zA-Z0-9_-]+\.(?:mjs|css)(?:\.map)?$/.test(name);
const failure = () => new Error('Bostan compiled runtime recovery is not safely isolated');

async function fileHash(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function getStat(path) {
  try { return await lstat(path); }
  catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
}

async function verifiedBackup(entry, outdir, backup) {
  const folder = await getStat(backup);
  if (!folder?.isDirectory() || folder.isSymbolicLink()) return false;
  const markerInfo = await getStat(join(backup, MARKER));
  if (!markerInfo?.isFile() || markerInfo.isSymbolicLink() ||
      markerInfo.size > MAX_MARKER_BYTES) return false;
  let manifest;
  try { manifest = JSON.parse(await readFile(join(backup, MARKER), 'utf8')); }
  catch { return false; }
  if (manifest?.schema !== SCHEMA || manifest.entry !== resolve(entry) ||
      manifest.outdir !== outdir || !Array.isArray(manifest.files) ||
      manifest.files.length < 2 || manifest.files.length > MAX_FILES) return false;
  const expected = new Set([MARKER]);
  for (const file of manifest.files) {
    if (!file || !generated(file.name) ||
        typeof file.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(file.sha256) ||
        expected.has(file.name)) return false;
    expected.add(file.name);
  }
  if (!expected.has('index.mjs') || !expected.has('server.mjs')) return false;
  const actual = await readdir(backup);
  if (actual.length !== expected.size || actual.some(name => !expected.has(name))) return false;
  for (const { name, sha256 } of manifest.files) {
    const path = join(backup, name);
    const stat = await getStat(path);
    if (!stat?.isFile() || stat.isSymbolicLink() || await fileHash(path) !== sha256)
      return false;
  }
  return true;
}

/**
 * Restore only the single provably owned backup after a crash between the
 * B1-28 directory renames. Never replace an existing destination, never
 * delete any candidate backup, and fail closed on ambiguity/corruption.
 * This is not a cross-process locking or fully atomic directory exchange.
 */
export async function recoverInterruptedRuntime({
  entry, outdir, assertSafeRuntimeOutdir, renameDirectory = rename,
}) {
  if (typeof entry !== 'string' || typeof outdir !== 'string' ||
      !isAbsolute(entry) || !isAbsolute(outdir) ||
      typeof assertSafeRuntimeOutdir !== 'function' ||
      typeof renameDirectory !== 'function') throw failure();

  // The existing admission checks the source entry, all parent links and
  // that no unowned or modified runtime currently occupies the destination.
  const canonical = await assertSafeRuntimeOutdir(entry, outdir);
  if (canonical !== resolve(outdir)) throw failure();
  if (await getStat(canonical)) return 'present';

  const prefix = `.bostan-${basename(canonical)}-rollback-`;
  const candidates = (await readdir(dirname(canonical))).filter(name => name.startsWith(prefix));
  if (candidates.length === 0) return 'none';
  if (candidates.length !== 1 || !UUID.test(candidates[0].slice(prefix.length))) throw failure();
  const backup = join(dirname(canonical), candidates[0]);
  if (!await verifiedBackup(entry, canonical, backup)) throw failure();

  // Source or ownership could have changed while hashing; re-admit the target
  // before the final rename and refuse to overwrite a newly appeared folder.
  if (await assertSafeRuntimeOutdir(entry, canonical) !== canonical ||
      await getStat(canonical)) throw failure();
  await renameDirectory(backup, canonical);
  await assertSafeRuntimeOutdir(entry, canonical);
  return 'restored';
}
