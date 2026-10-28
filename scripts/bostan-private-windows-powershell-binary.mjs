/**
 * Bostan private Windows QA: pin the read-only PostgreSQL scan to the
 * conventional OS PowerShell path, not an operator PATH or nested lookalike.
 * Inspect every directory component with lstat before returning a binary.
 * No subprocess is started here and no inspected path is echoed on failure.
 */
import {lstatSync} from 'node:fs';
import {win32} from 'node:path';

export function resolvePrivateWindowsPowerShellBinary({
  platform = process.platform,
  systemRoot = process.env.SystemRoot,
  statPath = lstatSync,
} = {}) {
  const refused = () => { throw Error('Private Windows QA PowerShell executable unavailable'); };
  // B1-08 accepted C:\\Untrusted\\Windows because basename() was "Windows".
  // Require the direct drive-root Windows directory; no nested lookalikes,
  // relative/UNC/device paths, alternate streams, dot segments or slashes.
  if (platform !== 'win32' || typeof systemRoot !== 'string' ||
      !/^[A-Za-z]:\\Windows\\?$/i.test(systemRoot) ||
      typeof statPath !== 'function') refused();
  const root = systemRoot.replace(/\\$/, '');
  const components = [
    root,
    win32.join(root, 'System32'),
    win32.join(root, 'System32', 'WindowsPowerShell'),
    win32.join(root, 'System32', 'WindowsPowerShell', 'v1.0'),
  ];
  const binary = win32.join(components[3], 'powershell.exe');
  try {
    for (const dir of components) {
      const stat = statPath(dir);
      if (stat?.isDirectory?.() !== true || stat?.isSymbolicLink?.() !== false) refused();
    }
    const stat = statPath(binary);
    if (stat?.isFile?.() !== true || stat?.isSymbolicLink?.() !== false) refused();
  } catch { refused(); }
  return binary;
}
