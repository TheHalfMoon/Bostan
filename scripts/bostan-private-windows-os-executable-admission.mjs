/**
 * Fail-closed, read-only native Windows OS executable identity preflight.
 * A canonical-looking SystemRoot string is not proof that the expected
 * system directories and cmd.exe are ordinary unlinked filesystem objects.
 * Do not start the QA PostgreSQL cluster or HTTP child on failed admission.
 */
import { lstatSync } from 'node:fs';
import { win32 } from 'node:path';

const refuse = () => { throw Error('Private Windows QA OS executable identity unverified'); };

export function assertPrivateWindowsQaOsExecutablePaths({
  inherited = process.env,
  platform = process.platform,
  statPath = lstatSync,
} = {}) {
  if (platform !== 'win32' || !inherited || typeof inherited !== 'object' ||
      typeof statPath !== 'function') refuse();
  const keys = new Map(Object.entries(inherited).map(([key, value]) => [key.toUpperCase(), value]));
  const systemRoot = keys.get('SYSTEMROOT');
  const windir = keys.get('WINDIR');
  if (typeof systemRoot !== 'string' ||
      !/^[A-Za-z]:\\Windows\\?$/i.test(systemRoot)) refuse();
  const root = systemRoot.replace(/\\$/, '');
  if (windir !== undefined && (typeof windir !== 'string' ||
      !/^[A-Za-z]:\\Windows\\?$/i.test(windir) ||
      windir.replace(/\\$/, '').toLowerCase() !== root.toLowerCase())) refuse();
  const drive = win32.parse(root).root;
  const system32 = win32.join(root, 'System32');
  const cmd = win32.join(system32, 'cmd.exe');
  try {
    for (const directory of [drive, root, system32]) {
      const stat = statPath(directory);
      if (stat?.isDirectory?.() !== true || stat?.isSymbolicLink?.() !== false) refuse();
    }
    const stat = statPath(cmd);
    if (stat?.isFile?.() !== true || stat?.isSymbolicLink?.() !== false) refuse();
  } catch { refuse(); }
  return Object.freeze({systemRoot:root, system32, cmd});
}
