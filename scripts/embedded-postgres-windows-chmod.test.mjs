import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const patch = readFileSync(new URL('../patches/embedded-postgres@18.1.0-beta.16.patch', import.meta.url), 'utf8');

test('Windows returns before POSIX executable permission handling', () => {
  const guard = "+    if (process.platform === 'win32') return;";
  const guardIndex = patch.indexOf(guard);
  const chmodIndex = patch.indexOf('fs.chmod');
  assert.ok(guardIndex >= 0, 'missing Windows-only guard');
  assert.ok(patch.includes('@@ -42,6 +42,10 @@'), 'guard must patch the executable permission helper');
  assert.match(patch.slice(guardIndex), /\n     \/\/ Only fix the file.s mode if it.s missing a permission/);
  assert.ok(chmodIndex === -1 || guardIndex < chmodIndex, 'Windows guard must precede chmod');
  assert.equal(patch.split(guard).length - 1, 1, 'guard must not be duplicated');
});

test('existing locale and inherited process environment patches remain intact', () => {
  assert.match(patch, /\+const LC_MESSAGES_LOCALE = 'C';/);
  assert.equal((patch.match(/\+.*globalThis\.process\.env/g) ?? []).length, 2);
});