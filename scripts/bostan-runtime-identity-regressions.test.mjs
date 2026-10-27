import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  formatNodeVersionWarning,
  isSupportedNodeVersion,
  NODE_VERSION_INSTALL_GUIDE_URL,
} from '../packages/shared/src/node-version.ts';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source = path => readFileSync(resolve(root,path),'utf8');

test('Bostan Node runtime guidance uses private source instructions, not the retired public installer',()=>{
  assert.equal(isSupportedNodeVersion('24.19.0'),true);
  assert.equal(isSupportedNodeVersion('22.0.0'),false);
  assert.equal(formatNodeVersionWarning('24.19.0'),null);
  const warning=formatNodeVersionWarning('22.0.0');
  assert.match(warning,/\[bostan\] warning: Node.js 22.0.0/);
  assert.match(warning,/Bostan requires Node.js 24.11.0 or newer/);
  assert.match(warning,/retired inherited public install.sh workflow/);
  assert.match(warning,/Restart Bostan after upgrading/);
  assert.doesNotMatch(warning,/npx paperclipai|\bPaperclip\b|paperclip\.ing/);
  assert.equal(NODE_VERSION_INSTALL_GUIDE_URL,'https://github.com/TheHalfMoon/Bostan');
});

test('remote Pi companion authorizes only the native Bostan installed server identity',()=>{
  const remote=source('server/src/services/native-runtime/remote-pi-companion.ts');
  assert.match(remote,/pkg\.name === "@bostan\/server", "Bostan server package required"/);
  assert.doesNotMatch(remote,/pkg\.name === "@paperclipai\/server"/);
  // Persisted imported archives and native daemon names deliberately retain their versioned contract.
  assert.match(remote,/paperclip\.remote-pi-companion\/v1/);
  assert.match(remote,/bin\/paperclip-runnerd/);
  const fixture=source('server/src/__tests__/remote-pi-companion.test.ts');
  assert.match(fixture,/@bostan\/server/);
});

test('first-party dependency closure follows Bostan packages without dropping legacy compatibility aliases',()=>{
  const install=source('cli/src/commands/install.ts');
  assert.match(install,/dependencyName\.startsWith\("@bostan\/"\)/);
  assert.match(install,/dependencyName\.startsWith\("@paperclipai\/"\)/);
  assert.match(install,/visit\("@bostan\/server"\)/);
  assert.doesNotMatch(install,/npx paperclipai@latest install --yes/);
});

test('first-party plugin instructions and visible placeholders do not suggest donor-branded product packages',()=>{
  const manager=source('ui/src/pages/PluginManager.tsx');
  assert.match(manager,/placeholder="@example\/bostan-plugin"/);
  assert.doesNotMatch(manager,/@paperclipai\/plugin-example/);
  const loader=source('server/src/services/plugin-loader.ts');
  assert.match(loader,/@bostan\/plugin-\*/);
});
