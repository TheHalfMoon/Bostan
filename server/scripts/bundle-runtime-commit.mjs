import { mkdir, rm, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve } from "node:path";

const MAX_OUTPUT_BYTES = 512 * 1024 * 1024;
const MAX_OUTPUT_FILES = 10_000;
const safeName = (name) => /^[a-zA-Z0-9_-]+\.(?:mjs|css)(?:\.map)?$/.test(name) && basename(name) === name;
const failure = () => new Error("Bostan compiled runtime output is not safely isolated");

/**
 * Replace a previously verified runtime only AFTER esbuild has completed its
 * in-memory build. This prevents compile/resolve failures from erasing the
 * currently working bundle. A write failure is NOT atomic: a partial,
 * unowned output will fail closed on the next attempt.
 */
export async function commitCompiledRuntimeOutputs({
  entry, outdir, result, assertSafeRuntimeOutdir, recordRuntimeOutputOwnership,
}) {
  if (typeof assertSafeRuntimeOutdir !== "function" ||
      typeof recordRuntimeOutputOwnership !== "function" ||
      !result || !Array.isArray(result.outputFiles) ||
      result.outputFiles.length < 2 || result.outputFiles.length > MAX_OUTPUT_FILES) throw failure();
  const canonical = await assertSafeRuntimeOutdir(entry, outdir);
  const names = new Set();
  let bytes = 0;
  const outputs = [];
  for (const file of result.outputFiles) {
    if (!file || typeof file.path !== "string" || !isAbsolute(file.path) ||
        !(file.contents instanceof Uint8Array)) throw failure();
    const name = relative(canonical, resolve(file.path));
    if (!safeName(name) || names.has(name)) throw failure();
    names.add(name);
    bytes += file.contents.byteLength;
    if (!Number.isSafeInteger(bytes) || bytes > MAX_OUTPUT_BYTES) throw failure();
    outputs.push({ name, contents: file.contents });
  }
  if (!names.has("index.mjs") || !names.has("server.mjs")) throw failure();
  // Repeat admission immediately before deleting any file: the destination
  // can change while the (potentially slow) compilation runs.
  if (await assertSafeRuntimeOutdir(entry, outdir) !== canonical) throw failure();
  await rm(canonical, { recursive: true, force: true });
  await mkdir(canonical);
  const paths = [];
  for (const { name, contents } of outputs) {
    const file = join(canonical, name);
    await writeFile(file, contents, { flag: "wx" });
    paths.push(file);
  }
  await recordRuntimeOutputOwnership(entry, canonical, paths);
  return canonical;
}

/** Force esbuild into non-writing mode before any previous runtime is erased. */
export async function buildAndCommitCompiledRuntime({
  entry, outdir, buildRuntime, options, assertSafeRuntimeOutdir, recordRuntimeOutputOwnership,
}) {
  if (typeof buildRuntime !== "function") throw failure();
  const admitted = await assertSafeRuntimeOutdir(entry, outdir);
  const result = await buildRuntime({ ...options, outdir: admitted, write: false });
  await commitCompiledRuntimeOutputs({
    entry, outdir: admitted, result, assertSafeRuntimeOutdir, recordRuntimeOutputOwnership,
  });
  return { result, admittedOutdir: admitted };
}
