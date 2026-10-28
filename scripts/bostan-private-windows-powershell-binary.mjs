/**
 * Bostan private Windows QA: pin the read-only PostgreSQL scan to the OS
 * PowerShell executable. Never search the operator-controlled PATH for it.
 * No process is started here; callers still own their bounded subprocess.
 */
import {lstatSync} from 'node:fs';
import {win32} from 'node:path';

export function resolvePrivateWindowsPowerShellBinary({
  platform = process.platform,
  systemRoot = process.env.SystemRoot,
  statBinary = lstatSync,
} = {}) {
  const refused = () => { throw Error('Private Windows QA PowerShell executable unavailable'); };
  if (platform !== 'win32' || typeof systemRoot !== 'string' ||
      systemRoot.length > 260 || !/^[A-Za-z]:\\/.test(systemRoot) ||
      /[\x00\r\n*?<>|]/.test(systemRoot) ||
      /[\\/]\.{1,2}(?:[\\/]|$)/.test(systemRoot) ||
      systemRoot.slice(2).includes(':') || typeof statBinary !== 'function') refused();
  const root = win32.normalize(systemRoot);
  if (win32.basename(root.replace(/[\\/]+$/, '')).toLowerCase() !== 'windows') refused();
  const binary = win32.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  try {
    const stat = statBinary(binary);
    if (!stat?.isFile?.() || stat?.isSymbolicLink?.() !== false) refused();
  } catch { refused(); }
  return binary;
}
