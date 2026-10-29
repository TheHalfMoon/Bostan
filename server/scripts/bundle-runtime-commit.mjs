import { createReadStream } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { recoverInterruptedRuntime } from './bundle-runtime-recovery.mjs';

const MAX_OUTPUT_BYTES = 512 * 1024 * 1024;
const MAX_OUTPUT_FILES = 10_000;
const MARKER = '.bostan-compiled-runtime-owner.json';
const SCHEMA = 'bostan.compiled-runtime-owner.v1';
const safeName = name => /^[a-zA-Z0-9_-]+\.(?:mjs|css)(?:\.map)?$/.test(name) && basename(name) === name;
const failure = () => new Error('Bostan compiled runtime output is not safely isolated');

async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

/** Verify a renamed previous Bostan runtime by exact ownership and bytes. */
async function verifiedPriorRuntime(entry, outdir, backup) {
  let manifest;
  try {
    const markerInfo = await lstat(join(backup, MARKER));
    if (!markerInfo.isFile() || markerInfo.isSymbolicLink() || markerInfo.size > 1_000_000) return false;
    manifest = JSON.parse(await readFile(join(backup, MARKER), 'utf8'));
  } catch { return false; }
  if (manifest?.schema !== SCHEMA || manifest.entry !== resolve(entry) ||
      manifest.outdir !== resolve(outdir) || !Array.isArray(manifest.files) ||
      manifest.files.length < 2 || manifest.files.length > MAX_OUTPUT_FILES) return false;
  const names = new Set();
  for (const item of manifest.files) {
    if (!item || !safeName(item.name) || names.has(item.name) ||
        !/^[a-f0-9]{64}$/.test(item.sha256)) return false;
    names.add(item.name);
  }
  if (!names.has('index.mjs') || !names.has('server.mjs')) return false;
  const actual = await readdir(backup);
  const allowed = new Set([MARKER, ...names]);
  if (actual.length !== allowed.size || actual.some(x => !allowed.has(x))) return false;
  for (const item of manifest.files) {
    const file = join(backup, item.name);
    const info = await lstat(file).catch(() => null);
    if (!info?.isFile() || info.isSymbolicLink() || await sha256(file) !== item.sha256) return false;
  }
  return true;
}

function preparedOutputs(canonical, result) {
  if (!result || !Array.isArray(result.outputFiles) || result.outputFiles.length < 2 ||
      result.outputFiles.length > MAX_OUTPUT_FILES) throw failure();
  const names = new Set();
  let bytes = 0;
  const outputs = [];
  for (const file of result.outputFiles) {
    if (!file || typeof file.path !== 'string' || !isAbsolute(file.path) ||
        !(file.contents instanceof Uint8Array)) throw failure();
    const name = relative(canonical, resolve(file.path));
    if (!safeName(name) || names.has(name)) throw failure();
    names.add(name);
    bytes += file.contents.byteLength;
    if (!Number.isSafeInteger(bytes) || bytes > MAX_OUTPUT_BYTES) throw failure();
    outputs.push({ name, contents: file.contents });
  }
  if (!names.has('index.mjs') || !names.has('server.mjs')) throw failure();
  return outputs;
}

function ownedStageName(canonical) {
  return join(dirname(canonical), '.bostan-' + basename(canonical) + '-pending-');
}

async function stageIsExactlyOurs(stage, outputs) {
  const info = await lstat(stage).catch(() => null);
  if (!info?.isDirectory() || info.isSymbolicLink()) return false;
  const listed = await readdir(stage);
  const expected = new Map(outputs.map(item => [item.name, item.contents]));
  if (listed.length !== expected.size || listed.some(name => !expected.has(name))) return false;
  for (const [name, contents] of expected) {
    const file = join(stage, name);
    const stat = await lstat(file).catch(() => null);
    if (!stat?.isFile() || stat.isSymbolicLink()) return false;
    if (await sha256(file) !== createHash('sha256').update(contents).digest('hex')) return false;
  }
  return true;
}

/**
 * Writes the entire freshly compiled output into a private same-volume stage.
 * The existing runtime is NEVER recursively deleted before new files and
 * ownership admission have passed. On a promotion or ownership error it tries
 * to restore the last runtime from its renamed sibling backup.
 *
 * This is crash-resistant but not a fully atomic directory exchange: a power
 * loss between the two same-volume renames can leave a recoverable backup.
 */
export async function commitCompiledRuntimeOutputs({
  entry, outdir, result, assertSafeRuntimeOutdir, recordRuntimeOutputOwnership,
  // Injected only by tests for deterministic simulated Windows rename failure.
  renameDirectory = rename,
}) {
  if (typeof assertSafeRuntimeOutdir !== 'function' ||
      typeof recordRuntimeOutputOwnership !== 'function' ||
      typeof renameDirectory !== 'function') throw failure();
  const canonical = await assertSafeRuntimeOutdir(entry, outdir);
  const outputs = preparedOutputs(canonical, result);
  // The parent directory was checked by the existing admission helper.
  const stage = await mkdtemp(ownedStageName(canonical));
  let backup = null;
  let promoted = false;
  let oldMoved = false;
  const oldExists = await lstat(canonical).then(() => true, error => {
    if (error?.code === 'ENOENT') return false;
    throw error;
  });
  try {
    for (const { name, contents } of outputs) {
      await writeFile(join(stage, name), contents, { flag: 'wx' });
    }
    // Source, target and prior contents must still qualify after staging.
    if (await assertSafeRuntimeOutdir(entry, outdir) !== canonical) throw failure();
    if (oldExists) {
      backup = join(dirname(canonical), '.bostan-' + basename(canonical) + '-rollback-' + randomUUID());
      await renameDirectory(canonical, backup);
      oldMoved = true;
    }
    try {
      await renameDirectory(stage, canonical);
      promoted = true;
      // The existing owner implementation records SHA256 of generated files
      // and refuses any unexpected content before writing the final marker.
      await recordRuntimeOutputOwnership(entry, canonical,
        outputs.map(item => join(canonical, item.name)));
    } catch (error) {
      if (oldMoved) {
        // Never delete the failed new output: move it to an isolated sibling.
        // If recovery is blocked by another process, leave the old backup
        // untouched rather than recursively removing anything unknown.
        if (promoted) {
          const rejected = join(dirname(canonical), '.bostan-' + basename(canonical) + '-rejected-' + randomUUID());
          await renameDirectory(canonical, rejected);
        }
        await renameDirectory(backup, canonical);
        oldMoved = false;
      }
      throw error;
    }
    if (oldMoved) {
      // Only remove a backup proven to consist of the previously owned Bostan
      // files with exact original hashes. Otherwise preserve it for inspection.
      try {
        const backupNames = await readdir(backup);
        if (backupNames.length === 0) {
          // An empty previously admitted runtime has no ownership manifest.
          await rmdir(backup);
        } else if (await verifiedPriorRuntime(entry, canonical, backup)) {
          await rm(backup, { recursive: true });
        }
      } catch {
        // A cleanup failure is not a failed deployment: preserve the old
        // snapshot for inspection without replacing the new working runtime.
      }
    }
    return canonical;
  } finally {
    // Reclaim our staged copy only if it still contains *exactly* the bytes
    // generated for this build. Preserve partial/foreign/linked files if their
    // provenance is uncertain rather than recursively erasing unknown content.
    try {
      if (await stageIsExactlyOurs(stage, outputs)) {
        await rm(stage, { recursive: true });
      }
    } catch {
      // A cleanup error never masks the original error or aborts a promoted
      // runtime. Unknown contents remain isolated for explicit inspection.
    }
  }
}

export async function buildAndCommitCompiledRuntime({
  entry, outdir, buildRuntime, options, assertSafeRuntimeOutdir, recordRuntimeOutputOwnership,
}) {
  if (typeof buildRuntime !== 'function') throw failure();
  // If the prior run lost power between two directory renames, recover its
  // single SHA-256-verified owned rollback before attempting a fresh build.
  await recoverInterruptedRuntime({ entry, outdir, assertSafeRuntimeOutdir });
  const admitted = await assertSafeRuntimeOutdir(entry, outdir);
  const result = await buildRuntime({ ...options, outdir: admitted, write: false });
  await commitCompiledRuntimeOutputs({ entry, outdir: admitted, result,
    assertSafeRuntimeOutdir, recordRuntimeOutputOwnership });
  return { result, admittedOutdir: admitted };
}
