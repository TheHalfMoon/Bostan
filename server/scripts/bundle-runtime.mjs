
import { readFile, rm, lstat } from "node:fs/promises";
import { dirname, isAbsolute, join, win32 } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { compiledRuntimeEntrySource, nativeEsmFileUrl } from "./compiled-runtime-entry.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const serverDir = join(scriptDir, "..");

const REQUIRE_SHIM = "import { createRequire as __paperclipCreateRequire } from 'node:module'; const require = __paperclipCreateRequire(import.meta.url);";

export function preserveModuleLocation(source, file) {
  return source
    .replace(/\bimport\.meta\.url\b/g, JSON.stringify(pathToFileURL(file).href))
    .replace(/\bimport\.meta\.dirname\b/g, JSON.stringify(dirname(file)))
    .replace(/\bimport\.meta\.filename\b/g, JSON.stringify(file));
}



// Temporary source-bundle proof only. The three developer runner shims load
// TypeScript at runtime; a plain-Node bundle must point at the equivalent
// previously built JS modules instead, without changing normal source mode.
const COMPILED_RUNNER_QA_MAPPINGS = Object.freeze([
  ["index.ts", "../../../../packages/paperclip-runner/src/index.ts",
    "../../../../packages/paperclip-runner/dist/index.js"],
  ["testing.ts", "../../../../packages/paperclip-runner/src/testing.ts",
    "../../../../packages/paperclip-runner/dist/testing.js"],
  ["live/index.ts", "../../../../../packages/paperclip-runner/src/live/index.ts",
    "../../../../../packages/paperclip-runner/dist/live/index.js"],
]);

export function compiledRunnerQaShim(source, file) {
  const normalized = file.replaceAll(String.fromCharCode(92), "/");
  for (const [relative, original, compiled] of COMPILED_RUNNER_QA_MAPPINGS) {
    if (!normalized.endsWith("/server/src/vendor/paperclip-runner/" + relative)) continue;
    const token = JSON.stringify(original);
    if (!source.includes(token)) {
      throw new Error("Bostan compiled QA bundle cannot locate the expected runner source shim");
    }
    return source.replace(token, JSON.stringify(compiled));
  }
  return source;
}

async function verifyQaRunnerBuild() {
  for (const [relative, , compiled] of COMPILED_RUNNER_QA_MAPPINGS) {
    const sourceShim = join(serverDir, "src", "vendor", "paperclip-runner", relative);
    const built = join(dirname(sourceShim), compiled);
    const item = await lstat(built).catch(() => null);
    if (!item?.isFile() || item.isSymbolicLink()) {
      throw new Error("Bostan QA plain-Node bundling requires a locally built runner TypeScript dist");
    }
  }
}

function runtimeEntry(entry) {
  return {
    name: "runtime-entry",
    setup(builder) {
      builder.onResolve({ filter: /^paperclip-runtime-entry$/ }, () => ({ path: "paperclip-runtime-entry", namespace: "runtime-entry" }));
      builder.onLoad({ filter: /.*/, namespace: "runtime-entry" }, () => ({
        contents: compiledRuntimeEntrySource(entry),
        loader: "js",
        resolveDir: dirname(entry),
      }));
    },
  };
}

function keepModuleLocations({ compiledRunnerQa = false } = {}) {
  return {
    name: "keep-module-locations",
    setup(builder) {
      builder.onLoad({ filter: /\.(?:[cm]?js|[cm]?ts)$/ }, async (args) => {
        if (args.path.includes("/node_modules/")) return undefined;
        const source = await readFile(args.path, "utf8");
        if (!source.includes("import.meta")) return undefined;
        return {
          contents: preserveModuleLocation(
            compiledRunnerQa ? compiledRunnerQaShim(source, args.path) : source, args.path,
          ),
          loader: /\.[cm]?ts$/.test(args.path) ? "ts" : "js",
          resolveDir: dirname(args.path),
        };
      });
    },
  };
}

/**
 * esbuild's bare-specifier filter also matches C:\source\server\index.ts.
 * Absolute Windows entry points must be resolved as paths, never as third-
 * party npm packages. The same guard handles Windows drive-letter paths
 * during cross-platform fixture testing on macOS/Linux.
 */
export function shouldResolveAsBarePackage(specifier) {
  return typeof specifier === "string"
    && /^[^./]/.test(specifier)
    && !isAbsolute(specifier)
    && !win32.isAbsolute(specifier)
    && !/^(node|file|data):/.test(specifier);
}

function externalizeThirdParty(isBundled, runtimeDir) {
  return {
    name: "externalize-third-party",
    setup(builder) {
      builder.onResolve({ filter: /^[^./]/ }, async (args) => {
        if (!shouldResolveAsBarePackage(args.path)) return undefined;
        if (args.pluginData?.externalizeThirdParty || isBundled(args.path)) return undefined;
        const resolved = await builder.resolve(args.path, {
          kind: args.kind,
          resolveDir: args.resolveDir,
          importer: args.importer,
          pluginData: { externalizeThirdParty: true },
        });
        if (resolved.errors.length > 0 || resolved.external) return { path: args.path, external: true };
        const fromServer = await builder.resolve(args.path, {
          kind: args.kind,
          resolveDir: runtimeDir,
          pluginData: { externalizeThirdParty: true },
        });
        if (fromServer.errors.length === 0 && fromServer.path === resolved.path) return { path: args.path, external: true };
        // A native Windows D:\\... specifier is interpreted as an unsupported d: URL
        // by Node ESM. External absolute package-private paths need file: URLs.
        return { path: nativeEsmFileUrl(resolved.path), external: true };
      });
    },
  };
}

export async function bundleRuntime({
  entry, outdir,
  isBundled = (specifier) => specifier.startsWith("@bostan/") || specifier.startsWith("@paperclipai/"),
  compiledRunnerQa = false,
}) {
  if (compiledRunnerQa) await verifyQaRunnerBuild();
  await rm(outdir, { recursive: true, force: true });
  const result = await build({
    entryPoints: { index: "paperclip-runtime-entry", server: entry },
    outdir,
    outExtension: { ".js": ".mjs" },
    chunkNames: "chunk-[hash]",
    bundle: true,
    splitting: true,
    format: "esm",
    platform: "node",
    target: "node24",
    mainFields: ["main"],
    conditions: ["node", "bostan-compiled"],
    banner: { js: REQUIRE_SHIM },
    sourcemap: "linked",
    metafile: true,
    logLevel: "error",
    plugins: [runtimeEntry(entry), keepModuleLocations({ compiledRunnerQa }),
      externalizeThirdParty(isBundled, dirname(entry))],
  });
  const outputs = Object.keys(result.metafile.outputs).filter((file) => file.endsWith(".mjs"));
  return {
    outfile: join(outdir, "index.mjs"),
    serverModule: join(outdir, "server.mjs"),
    inputs: Object.keys(result.metafile.inputs).length,
    chunks: outputs.length,
  };
}

async function main() {
  const started = performance.now();
  const summary = await bundleRuntime({ entry: join(serverDir, "dist", "index.js"), outdir: join(serverDir, "dist-runtime") });
  console.log(`[bundle-runtime] ${summary.inputs} inputs -> ${summary.chunks} chunks in ${Math.round(performance.now() - started)} ms: ${summary.outfile}`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
