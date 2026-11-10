import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('native PostgreSQL CIM inspector never resolves PowerShell through PATH',()=>{
  const src=readFileSync(new URL('./windows-embedded-postgres-stop.ts',import.meta.url),'utf8');
  assert.match(src,/resolveWindowsPostgresInspectorBinary\(\)/);
  assert.doesNotMatch(src,/execAsync\("powershell\.exe"/);
});
test('inspector selection remains inside the fail-closed CIM exception handler',()=>{
  const src=readFileSync(new URL('./windows-embedded-postgres-stop.ts',import.meta.url),'utf8');
  const start=src.indexOf('const actualInspect: Inspector = async () => {');
  const guarded=src.indexOf('try {',start);
  const call=src.indexOf('resolveWindowsPostgresInspectorBinary();',start);
  const scan=src.indexOf('inspectorSession.inspect()',start);
  const refused=src.indexOf('throw Error("Unable to inspect Windows PostgreSQL processes; retaining fixture");',start);
  assert(start>=0 && guarded>start && call>guarded && scan>call && refused>scan);
});
test('the reused inspector session resolves the pinned PowerShell binary, never PATH',()=>{
  const src=readFileSync(new URL('./windows-postgres-inspector-session.ts',import.meta.url),'utf8');
  assert.match(src,/spawnInspector\(resolveWindowsPostgresInspectorBinary\(\), \[/);
  assert.doesNotMatch(src,/spawn\("powershell/);
  assert.match(src,/shell: false/);
});
