/**
 * Test-only Windows PostgreSQL CIM scanner: pin the OS PowerShell binary.
 * Executing a bare powershell.exe would consult untrusted operator PATH.
 * Fail closed on ambiguous SystemRoot or linked/missing OS components.
 */
import {lstatSync} from 'node:fs';
import {win32} from 'node:path';

const REFUSED='Bostan Windows PostgreSQL process inspector unavailable; retaining fixture';
export function resolveWindowsPostgresInspectorBinary(options={}) {
  const {platform=process.platform,statPath=lstatSync}=options;
  const systemRoot=Object.hasOwn(options,'systemRoot')?options.systemRoot:process.env.SystemRoot;
  const fail=()=>{throw Error(REFUSED);};
  if(platform!=='win32'||typeof systemRoot!=='string'||
      !/^[A-Za-z]:\\Windows\\?$/i.test(systemRoot)||typeof statPath!=='function')fail();
  const root=systemRoot.replace(/\\$/,'');
  const components=[root,win32.join(root,'System32'),
    win32.join(root,'System32','WindowsPowerShell'),
    win32.join(root,'System32','WindowsPowerShell','v1.0')];
  const binary=win32.join(components[3],'powershell.exe');
  try {
    for (const dir of components) {
      const s=statPath(dir);
      if(s?.isDirectory?.()!==true || s?.isSymbolicLink?.()!==false)fail();
    }
    const s=statPath(binary);
    if(s?.isFile?.()!==true || s?.isSymbolicLink?.()!==false)fail();
  } catch {fail();}
  return binary;
}
