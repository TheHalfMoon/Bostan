import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const patch = readFileSync(new URL('../patches/embedded-postgres@18.1.0-beta.16.patch', import.meta.url), 'utf8');
test('Windows skips POSIX chmod on dependency-owned PostgreSQL binaries', () => {
  assert.match(patch, /\+    if \(process\.platform === 'win32'\) return;/);
  assert.match(patch, /\+    if \(process\.platform === 'win32'\) return;\n     \/\/ Only fix/);
});
test('existing locale and inherited process environment patches remain intact', () => {
  assert.match(patch, /\+const LC_MESSAGES_LOCALE = 'C';/);
  assert.equal((patch.match(/\+.*globalThis\.process\.env/g) ?? []).length, 2);
});
