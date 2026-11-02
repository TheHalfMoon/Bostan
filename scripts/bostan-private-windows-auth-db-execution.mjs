/** Fail-closed execution plan for the legacy private Windows auth/DB QA runner.
 * No PATH shell resolution, no ambient credentials or profile directories.
 * Does not run a command; the native runner owns all process lifetimes.
 */
import {lstatSync, realpathSync, readFileSync} from 'node:fs';
import {dirname, isAbsolute, join, relative, resolve, sep, win32} from 'node:path';

const refused = () => { throw Error('Private Windows auth/DB QA executable admission refused'); };
const inside = (parent, child) => {
  const rel = relative(parent, child);
  return rel !== '' && rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel);
};
const tools = Object.freeze([
  ['shared tsc', 'packages/shared', 'typescript', 'bin/tsc'],
  ['sdk tsc', 'packages/plugins/sdk', 'typescript', 'bin/tsc'],
  ['server vitest', 'server', 'vitest', 'vitest.mjs'],
  ['db vitest', 'packages/db', 'vitest', 'vitest.mjs'],
]);

export function buildPrivateWindowsAuthDbExecution({
  root, temp, inherited = {}, osPaths, powershell, nodeBinary = process.execPath,
  platform = process.platform, statPath = lstatSync,
  realPath = realpathSync, readText = p => readFileSync(p, 'utf8'),
} = {}) {
  if (platform !== 'win32' || !isAbsolute(root ?? '') || resolve(root) !== root ||
      !isAbsolute(temp ?? '') || resolve(temp) !== temp ||
      typeof statPath !== 'function' || typeof realPath !== 'function' ||
      typeof readText !== 'function' || !inherited || typeof inherited !== 'object') refused();
  const rootStat = statPath(root), tempStat = statPath(temp);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() ||
      !tempStat.isDirectory() || tempStat.isSymbolicLink() ||
      realPath(root) !== root || realPath(temp) !== temp ||
      root === temp || inside(root, temp) || inside(temp, root)) refused();
  if (!osPaths || !/^[A-Za-z]:\\Windows$/i.test(osPaths.systemRoot ?? '') ||
      osPaths.system32?.toLowerCase() !== win32.join(osPaths.systemRoot, 'System32').toLowerCase() ||
      osPaths.cmd?.toLowerCase() !== win32.join(osPaths.system32, 'cmd.exe').toLowerCase() ||
      powershell?.toLowerCase() !== win32.join(osPaths.system32, 'WindowsPowerShell', 'v1.0', 'powershell.exe').toLowerCase()) refused();
  const values = new Map(Object.entries(inherited).map(([key, value]) => [key.toUpperCase(), value]));
  const windir = values.get('WINDIR');
  if (values.get('SYSTEMROOT')?.replace?.(/\\$/, '').toLowerCase() !== osPaths.systemRoot.toLowerCase() ||
      (windir !== undefined && windir?.replace?.(/\\$/, '').toLowerCase() !== osPaths.systemRoot.toLowerCase())) refused();
  // process.execPath is outside the checkout trust boundary. Refuse an
  // executable reached through an ancestor junction/symlink or dot alias;
  // checking only its leaf lstat would admit redirected Node installations.
  if (typeof nodeBinary !== 'string' || !isAbsolute(nodeBinary) ||
      resolve(nodeBinary) !== nodeBinary) refused();
  let nodeAncestor=dirname(nodeBinary);
  for (;;) {
    const info=statPath(nodeAncestor);
    if (!info.isDirectory() || info.isSymbolicLink() ||
        realPath(nodeAncestor) !== nodeAncestor) refused();
    const parent=dirname(nodeAncestor);
    if (parent===nodeAncestor) break;
    nodeAncestor=parent;
  }
  const nodeInfo=statPath(nodeBinary);
  if (!nodeInfo.isFile() || nodeInfo.isSymbolicLink() ||
      realPath(nodeBinary) !== nodeBinary) refused();
  const binaries = new Map();
  for (const [name, scope, pkg, entry] of tools) {
    let dir = root;
    for (const component of scope.split('/').concat('node_modules')) {
      dir = join(dir, component);
      const info = statPath(dir);
      if (!info.isDirectory() || info.isSymbolicLink()) refused();
    }
    const linked = join(dir, pkg);
    const linkInfo = statPath(linked);
    if (!linkInfo.isDirectory() && !linkInfo.isSymbolicLink()) refused();
    const physical = realPath(linked);
    if (!inside(root, physical) || !statPath(physical).isDirectory()) refused();
    const manifest = join(physical, 'package.json');
    const info = statPath(manifest);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 131072 || info.size < 2) refused();
    if (realPath(manifest) !== manifest) refused();
    let identity;
    try { identity = JSON.parse(readText(manifest)); } catch { refused(); }
    if (identity?.name !== pkg) refused();
    const file = join(linked, ...entry.split('/'));
    const actual = realPath(file);
    if (!inside(physical, actual) || !inside(root, actual) ||
        !statPath(actual).isFile() || statPath(actual).isSymbolicLink()) refused();
    binaries.set(name, actual);
  }
  const env = Object.freeze({
    SystemRoot:osPaths.systemRoot, WINDIR:osPaths.systemRoot,
    SystemDrive:osPaths.systemRoot.slice(0,2),
    PATH:osPaths.system32, PATHEXT:'.COM;.EXE;.BAT;.CMD', ComSpec:osPaths.cmd,
    HOME:temp, USERPROFILE:temp, TEMP:temp, TMP:temp,
    APPDATA:temp, LOCALAPPDATA:temp, XDG_CONFIG_HOME:temp,
    CI:'1', DO_NOT_TRACK:'1', OTEL_SDK_DISABLED:'true',
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:'1', npm_config_offline:'true',
    PAPERCLIP_TEST_POSTGRES_TEMPLATE:'0',
  });
  const command = (name, binary, args, cwd, timeout = 240000) =>
    Object.freeze({name, binary, args:Object.freeze(args), cwd, timeout});
  const commands = Object.freeze([
    command('read-only orphan gate', powershell,
      ['-NoProfile','-NonInteractive','-File',join(root,'scripts','bostan-native-windows-postgres-no-orphans.ps1'),'-Run'],root,20000),
    command('shared TypeScript build',nodeBinary,[binaries.get('shared tsc')],join(root,'packages/shared')),
    command('shared legal asset copy',nodeBinary,[join(root,'packages/shared/scripts/copy-cliplab-notices.mjs')],join(root,'packages/shared')),
    command('plugin SDK TypeScript build',nodeBinary,[binaries.get('sdk tsc')],join(root,'packages/plugins/sdk')),
    command('HTTP authentication and first-admin route tests',nodeBinary,
      [binaries.get('server vitest'),'run','src/__tests__/auth-routes.test.ts',
       'src/__tests__/bootstrap-claim-routes.test.ts','--reporter=dot'],join(root,'server')),
    command('real embedded PostgreSQL migration/reset',nodeBinary,
      [binaries.get('db vitest'),'run','src/client.test.ts','-t',
       'names its backends|recreates an existing database|migrates fresh through the normal loader',
       '--reporter=dot'],join(root,'packages/db')),
    command('final read-only orphan gate',powershell,
      ['-NoProfile','-NonInteractive','-File',join(root,'scripts','bostan-native-windows-postgres-no-orphans.ps1'),'-Run'],root,20000),
  ]);
  // The two non-package scripts must also be ordinary, unlinked checkout files.
  for (const file of [join(root,'scripts','bostan-native-windows-postgres-no-orphans.ps1'),
                      join(root,'packages/shared/scripts/copy-cliplab-notices.mjs')]) {
    if (!inside(root,file) || !statPath(file).isFile() || statPath(file).isSymbolicLink() ||
        realPath(file) !== file) refused();
  }
  return Object.freeze({env,commands});
}
