import { join, isAbsolute, resolve } from 'node:path';
import { assertSafeRuntimeOutdir } from '../server/scripts/bundle-runtime-output-admission.mjs';

const SOURCE_IMPORTS = Object.freeze([
  '--import', 'tsx',
  '--import', '../scripts/bostan-private-windows-import-profiler.mjs',
  '../scripts/bostan-private-windows-server-entry.mjs',
]);

/**
 * Resolve an explicitly selected native-Windows HTTP QA execution mode.
 * Never silently fall back to TypeScript if the compiled bundle is missing,
 * unowned, linked, modified, or bound to a different built source.
 *
 * This is a preflight only: the server/PG/HTTP/Chromium gates must still run
 * and pass to qualify the actual product.
 */
export async function resolvePrivateWindowsQaServerCommand({
  root, mode, validateRuntime = assertSafeRuntimeOutdir,
}) {
  if (typeof root !== 'string' || !isAbsolute(root) ||
      root !== resolve(root) || typeof validateRuntime !== 'function') {
    throw Error('Bostan Windows HTTP QA server command is unsafe');
  }
  if (mode === 'source') {
    return { mode: 'source', nodeArgs: [...SOURCE_IMPORTS] };
  }
  if (mode !== 'compiled') {
    throw Error('Bostan Windows HTTP QA server mode is unsupported');
  }
  const builtSource = join(root, 'server', 'dist', 'index.js');
  const output = join(root, 'server', 'dist-runtime');
  const admitted = await validateRuntime(builtSource, output);
  if (admitted !== output) {
    throw Error('Bostan compiled runtime ownership was not verified');
  }
  return { mode: 'compiled', nodeArgs: [join(output, 'index.mjs')] };
}
