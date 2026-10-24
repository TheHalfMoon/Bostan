import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createColdSnapshot, verifyColdSnapshot, restoreColdSnapshot } from "./bostan-cold-snapshot.mjs";

const MARKER = "bostan-managed-source-runtime-v1";
function fixture() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-cold-"));
  const home = path.join(parent, "home");
  const app = path.join(home, ".bostan", "app");
  const cfg = path.join(app, "state", "instances", "local");
  const pg = path.join(parent, "fake-pgctl");
  fs.mkdirSync(cfg, { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.join(app, "postgres", "data"), { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.join(app, "secrets"), { mode: 0o700 });
  fs.writeFileSync(path.join(cfg, "config.json"), JSON.stringify({ bostanManagedLocalRuntime: MARKER }), { mode: 0o600 });
  fs.writeFileSync(path.join(app, "postgres", "data", "PG_VERSION"), "17\n", { mode: 0o600 });
  fs.writeFileSync(path.join(app, "secrets", "agent-jwt"), "secret-example", { mode: 0o600 });
  const tool = (code) => fs.writeFileSync(pg, "#!/bin/sh\nexit " + code + "\n", { mode: 0o700 });
  tool(3);
  return { parent, home, app, pg, tool, restore: path.join(parent, "new-home"),
    cleanup: () => fs.rmSync(parent, { recursive: true, force: true }) };
}
function run(fn) { const f = fixture(); try { fn(f); } finally { f.cleanup(); } }
test("creates and validates private cold snapshot; excludes runtime lock", () => run(f => {
  const result = createColdSnapshot({home:f.home,pgCtl:f.pg});
  assert.ok(result.path.startsWith(path.join(f.home, ".bostan", "backups")));
  assert.equal(fs.existsSync(path.join(f.app, "run.lock")), false);
  assert.equal(fs.existsSync(path.join(result.path, "payload", "run.lock")), false);
  const validation = verifyColdSnapshot(result.path);
  assert.equal(validation.files, result.files);
  assert.equal(fs.readFileSync(path.join(result.path,"payload","postgres","data","PG_VERSION"),"utf8"),"17\n");
}));
test("restores into a new HOME without overwriting existing data", () => run(f => {
  const backup = createColdSnapshot({home:f.home,pgCtl:f.pg}).path;
  assert.equal(restoreColdSnapshot({backup,targetHome:f.restore}).files > 0, true);
  assert.equal(fs.readFileSync(path.join(f.restore,".bostan","app","secrets","agent-jwt"),"utf8"),"secret-example");
  assert.equal(fs.existsSync(path.join(f.restore,".bostan","app","run.lock")),false);
  const restoredCfg=JSON.parse(fs.readFileSync(path.join(f.restore,".bostan","app","state","instances","local","config.json"),"utf8"));
  assert.equal(restoredCfg.bostanManagedLocalRuntime, MARKER);
  assert.throws(()=>restoreColdSnapshot({backup,targetHome:f.restore}), /refusing overwrite/);
}));
test("restore rebases only launcher-owned secret, storage, logging and backup paths", () => run(f => {
  const filename=path.join(f.app,"state","instances","local","config.json");
  const cfg=JSON.parse(fs.readFileSync(filename,"utf8"));
  cfg.database={backup:{dir:path.join(f.app,"state","instances","local","data","backups")}};
  cfg.logging={logDir:path.join(f.app,"state","instances","local","logs")};
  cfg.storage={localDisk:{baseDir:path.join(f.app,"state","instances","local","data","storage")}};
  cfg.secrets={localEncrypted:{keyFilePath:path.join(f.app,"state","instances","local","secrets","master.key")}};
  fs.writeFileSync(filename,JSON.stringify(cfg),{mode:0o600});
  const backup=createColdSnapshot({home:f.home,pgCtl:f.pg}).path;
  restoreColdSnapshot({backup,targetHome:f.restore});
  const migrated=JSON.parse(fs.readFileSync(path.join(f.restore,".bostan","app","state","instances","local","config.json"),"utf8"));
  for (const value of [
    migrated.database.backup.dir,migrated.logging.logDir,
    migrated.storage.localDisk.baseDir,migrated.secrets.localEncrypted.keyFilePath,
  ]) {
    assert.ok(value.startsWith(path.join(f.restore,".bostan","app")+path.sep));
    assert.ok(!value.includes(f.home));
  }
}));
test("restore rejects launcher-managed external paths and leaves original HOME untouched", () => run(f => {
  const filename=path.join(f.app,"state","instances","local","config.json");
  const cfg=JSON.parse(fs.readFileSync(filename,"utf8"));
  cfg.secrets={localEncrypted:{keyFilePath:"/foreign/secret/master.key"}};
  fs.writeFileSync(filename,JSON.stringify(cfg));
  const backup=createColdSnapshot({home:f.home,pgCtl:f.pg}).path;
  assert.throws(()=>restoreColdSnapshot({backup,targetHome:f.restore}),/Unsafe external/);
  assert.equal(fs.existsSync(f.restore),false);
  assert.equal(fs.readFileSync(filename,"utf8"),JSON.stringify(cfg));
}));
test("restore rejects manifest without valid sourceApp before touching target HOME", () => run(f => {
  const backup=createColdSnapshot({home:f.home,pgCtl:f.pg}).path;
  const file=path.join(backup,"manifest.json");
  const manifest=JSON.parse(fs.readFileSync(file,"utf8"));
  manifest.sourceApp="../foreign";
  fs.writeFileSync(file,JSON.stringify(manifest));
  assert.throws(()=>restoreColdSnapshot({backup,targetHome:f.restore}),/Unsupported Bostan backup format/);
  assert.equal(fs.existsSync(f.restore),false);
}));
test("refuses backup if PostgreSQL is running and never creates a lock", () => run(f => {
  f.tool(0); assert.throws(()=>createColdSnapshot({home:f.home,pgCtl:f.pg}),/requires PostgreSQL stopped/);
  assert.equal(fs.existsSync(path.join(f.app, "run.lock")),false);
}));
test("refuses backup if PostgreSQL status is unknown", () => run(f => {
  f.tool(4); assert.throws(()=>createColdSnapshot({home:f.home,pgCtl:f.pg}),/requires PostgreSQL stopped/);
}));
test("refuses backup when run.lock already exists", () => run(f => {
  fs.writeFileSync(path.join(f.app,"run.lock"),MARKER+":"+process.pid+"\n",{mode:0o600});
  assert.throws(()=>createColdSnapshot({home:f.home,pgCtl:f.pg}),/Stop Bostan/);
}));
test("refuses non-Bostan managed config", () => run(f => {
  fs.writeFileSync(path.join(f.app,"state","instances","local","config.json"),'{"bostanManagedLocalRuntime":"foreign"}');
  assert.throws(()=>createColdSnapshot({home:f.home,pgCtl:f.pg}),/non-Bostan/);
}));
test("refuses symlinks in private data tree", () => run(f => {
  fs.symlinkSync(f.pg,path.join(f.app,"postgres","data","evil"));
  assert.throws(()=>createColdSnapshot({home:f.home,pgCtl:f.pg}),/Symlink/);
  assert.equal(fs.existsSync(path.join(f.app,"run.lock")),false);
}));
test("refuses special and hardlinked entries", () => run(f => {
  const original=path.join(f.app,"secrets","agent-jwt");
  fs.linkSync(original,path.join(f.app,"secrets","duplicate"));
  assert.throws(()=>createColdSnapshot({home:f.home,pgCtl:f.pg}),/hard-linked/);
}));
test("detects corrupt file after successful backup and refuses restore", () => run(f => {
  const backup=createColdSnapshot({home:f.home,pgCtl:f.pg}).path;
  fs.writeFileSync(path.join(backup,"payload","secrets","agent-jwt"),"altered");
  assert.throws(()=>verifyColdSnapshot(backup),/integrity/);
  assert.throws(()=>restoreColdSnapshot({backup,targetHome:f.restore}),/integrity/);
  assert.equal(fs.existsSync(f.restore),false);
}));
test("rejects an extra file injected into the cold snapshot", () => run(f => {
  const backup=createColdSnapshot({home:f.home,pgCtl:f.pg}).path;
  fs.writeFileSync(path.join(backup,"payload","unlisted"),"bad");
  assert.throws(()=>verifyColdSnapshot(backup),/integrity/);
}));
test("rejects forged traversal or duplicate path in manifest", () => run(f => {
  const backup=createColdSnapshot({home:f.home,pgCtl:f.pg}).path;
  const manifestFile=path.join(backup,"manifest.json");
  const obj=JSON.parse(fs.readFileSync(manifestFile,"utf8"));
  obj.entries.push({path:"../outside",type:"file",size:0,sha256:"0".repeat(64)});
  fs.writeFileSync(manifestFile,JSON.stringify(obj));
  assert.throws(()=>restoreColdSnapshot({backup,targetHome:f.restore}),/Invalid Bostan backup manifest path|Unsafe Bostan backup entry name/);
  assert.equal(fs.existsSync(f.restore),false);
}));
test("restore refuses a target nested inside its own snapshot", () => run(f => {
  const backup=createColdSnapshot({home:f.home,pgCtl:f.pg}).path;
  const nested=path.join(backup,"nested-home");
  assert.throws(()=>restoreColdSnapshot({backup,targetHome:nested}),/outside the source snapshot/);
  assert.equal(fs.existsSync(nested),false);
  assert.doesNotThrow(()=>verifyColdSnapshot(backup));
}));
test("restore target must be a nonexistent, normalized absolute HOME", () => run(f => {
  const backup=createColdSnapshot({home:f.home,pgCtl:f.pg}).path;
  assert.throws(()=>restoreColdSnapshot({backup,targetHome:f.home}),/refusing overwrite/);
  assert.throws(()=>restoreColdSnapshot({backup,targetHome:"relative"}),/normalized absolute/);
}));
test("refuses snapshot with inherited active PostgreSQL pid marker", () => run(f => {
  fs.writeFileSync(path.join(f.app,"postgres","data","postmaster.pid"),"1234\n",{mode:0o600});
  assert.throws(()=>createColdSnapshot({home:f.home,pgCtl:f.pg}),/active runtime marker/);
  assert.equal(fs.existsSync(path.join(f.app, "run.lock")),false);
}));
