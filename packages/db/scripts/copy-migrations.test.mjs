import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync,
  symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { copyBostanDbMigrations } from './copy-migrations.mjs';

const script = fileURLToPath(new URL('./copy-migrations.mjs', import.meta.url));
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'bostan-db-copy-fixture-'));
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({name:'@bostan/db',private:true}));
    mkdirSync(join(root, 'src', 'migrations', 'meta'), {recursive:true});
    const sql = ['0000_first.sql', '0001_second.sql'];
    writeFileSync(join(root, 'src', 'migrations', sql[0]), 'select 1;\r\n');
    writeFileSync(join(root, 'src', 'migrations', sql[1]), 'select 2;\n');
    writeFileSync(join(root, 'src', 'migrations', 'meta', '_journal.json'),
      JSON.stringify({entries:sql.map(tag=>({tag:tag.slice(0,-4)}))}));
    return run(root);
  } finally {rmSync(root, {recursive:true,force:true});}
}
test('portable migration copy keeps SQL/journal bytes and safely replaces stale files',()=>{
  fixture(root=>{
    const original=readFileSync(join(root,'src/migrations/0000_first.sql'));
    assert.deepEqual(copyBostanDbMigrations(root),{
      schema:'bostan.db-portable-migrations.v1',files:2,journalEntries:2,bytePreserved:true,
    });
    assert.deepEqual(readFileSync(join(root,'dist/migrations/0000_first.sql')),original);
    const outdated=join(root,'dist/migrations/stale.sql');
    writeFileSync(outdated,'outdated');
    assert.equal(copyBostanDbMigrations(root).files,2);
    assert.equal(existsSync(outdated),false,'old migration files must never survive new output');
    assert.deepEqual(readFileSync(join(root,'dist/migrations/meta/_journal.json')),
      readFileSync(join(root,'src/migrations/meta/_journal.json')));
  });
});
test('bad journal rejects before touching the current compiled migration output',()=>{
  fixture(root=>{
    copyBostanDbMigrations(root);
    const current=join(root,'dist/migrations/0000_first.sql');
    writeFileSync(join(root,'src/migrations/meta/_journal.json'),
      JSON.stringify({entries:[{tag:'0000_first'}]}));
    assert.throws(()=>copyBostanDbMigrations(root),/do not match/);
    assert.equal(readFileSync(current,'utf8'),'select 1;\r\n');
  });
});
test('private Bostan package identity is mandatory',()=>{
  fixture(root=>{
    writeFileSync(join(root,'package.json'),JSON.stringify({name:'@not-bostan/db',private:true}));
    assert.throws(()=>copyBostanDbMigrations(root),/Not a private/);
    assert.equal(existsSync(join(root,'dist')),false);
  });
});
test('symlinked dist is rejected rather than following a foreign target',t=>{
  fixture(root=>{
    const elsewhere=mkdtempSync(join(tmpdir(),'bostan-db-foreign-'));
    try {
      try {symlinkSync(elsewhere,join(root,'dist'),'dir');}
      catch(error) {
        if(process.platform==='win32'&&['EPERM','EACCES'].includes(error.code)){
          t.skip('Windows requires special permission for symlink creation');
          return;
        }
        throw error;
      }
      assert.throws(()=>copyBostanDbMigrations(root),/must be owned|not a symlink/);
      assert.deepEqual(readFileSync(join(root,'src/migrations/0000_first.sql'),'utf8'),'select 1;\r\n');
    }finally{rmSync(elsewhere,{recursive:true,force:true});}
  });
});
test('unexpected CLI arguments do not create compiled assets',()=>{
  const got=spawnSync(process.execPath,[script,'--output','/tmp/something'],{encoding:'utf8'});
  assert.equal(got.status,2);
  assert.match(got.stderr,/Usage:/);
});
