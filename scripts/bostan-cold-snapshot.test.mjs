import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { createColdSnapshot, verifyColdSnapshot, restoreColdSnapshot } from "./bostan-cold-snapshot.mjs";

const MARKER = "bostan-managed-source-runtime-v1";

// The POSIX fake pg_ctl is a shell script. On native Windows, spawnSync with
// shell:false correctly refuses that file and reports status unknown. Compile
// an isolated *test-only* Windows executable with the .NET compiler provided
// by Windows PowerShell instead of weakening production PG status admission.
// No external download, persistent executable, PowerShell profile change,
// system service, database or source worktree mutation is required.
let nativeWindowsPgCtl = null;
if (process.platform === "win32") {
  const toolsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-pgctl-unit-"));
  test.after(() => fs.rmSync(toolsRoot, { recursive: true, force: true }));
  const executable = path.join(toolsRoot, "fake-pgctl.exe");
  const code = `
using System;
using System.IO;
public class BostanFakePgCtl {
  public static int Main(string[] arguments) {
    for (int i = 0; i < arguments.Length - 1; i++) {
      if (arguments[i] != "-D") continue;
      string databaseDir = arguments[i + 1];
      if (arguments[arguments.Length - 1] != "status") return 4;
      string statusFile = Path.Combine(databaseDir, ".bostan-test-pgctl-status");
      int status;
      return File.Exists(statusFile) &&
        Int32.TryParse(File.ReadAllText(statusFile), out status) ? status : 4;
    }
    return 4;
  }
}`;
  const command = `Add-Type -TypeDefinition @'\n${code}\n'@ -OutputAssembly '${executable.replaceAll("'", "''")}' -OutputType ConsoleApplication -ErrorAction Stop`;
  const encoded = Buffer.from(command, "utf16le").toString("base64");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
    { encoding: "utf8", timeout: 60_000, windowsHide: true });
  if (result.error || result.status !== 0 || !fs.existsSync(executable)) {
    throw new Error("Cannot compile private Windows pg_ctl test fixture: " +
      String(result.error?.message ?? result.stderr ?? result.status).slice(0, 500));
  }
  nativeWindowsPgCtl = executable;
}

function fixture() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-cold-"));
  const home = path.join(parent, "home");
  const app = path.join(home, ".bostan", "app");
  const cfg = path.join(app, "state", "instances", "local");
  const pg = nativeWindowsPgCtl ?? path.join(parent, "fake-pgctl");
  fs.mkdirSync(cfg, { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.join(app, "postgres", "data"), { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.join(app, "secrets"), { mode: 0o700 });
  fs.writeFileSync(path.join(cfg, "config.json"), JSON.stringify({ bostanManagedLocalRuntime: MARKER }), { mode: 0o600 });
  fs.writeFileSync(path.join(app, "postgres", "data", "PG_VERSION"), "17\n", { mode: 0o600 });
  fs.writeFileSync(path.join(app, "secrets", "agent-jwt"), "secret-example", { mode: 0o600 });
  const tool = nativeWindowsPgCtl
    ? (code) => fs.writeFileSync(path.join(app, "postgres", "data", ".bostan-test-pgctl-status"), String(code), { mode: 0o600 })
    : (code) => fs.writeFileSync(pg, "#!/bin/sh\nexit " + code + "\n", { mode: 0o700 });
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
test("refuses symlinks and native Windows junctions in private data tree", () => run(f => {
  const evil = path.join(f.app, "postgres", "data", "evil");
  // Windows without Developer Mode typically refuses ordinary symlinks with
  // EPERM. NTFS junctions need no elevation and still exercise the real
  // reparse-point rejection in the Bostan snapshot walker.
  if (process.platform === "win32") fs.symlinkSync(f.app, evil, "junction");
  else fs.symlinkSync(f.pg, evil);
  assert.throws(() => createColdSnapshot({ home: f.home, pgCtl: f.pg }), /Symlink/);
  assert.equal(fs.existsSync(path.join(f.app, "run.lock")), false);
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
