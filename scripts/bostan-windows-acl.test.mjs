import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  enforceWindowsQaPrivateAcl,
  windowsPrivateAclTarget,
} from "./bostan-windows-acl.mjs";
import { runLocalRuntime } from "./bostan-local-runtime.mjs";

const onlyWindows = process.platform === "win32" ? test : test.skip;
function fixture(fn) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-acl-qa-"));
  fs.mkdirSync(path.join(home, ".bostan"));
  try { return fn(home); }
  finally { fs.rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
}

onlyWindows("applies private NTFS DACL once and verifies it again on restart", () => fixture(home => {
  assert.equal(windowsPrivateAclTarget(home), path.join(home, ".bostan"));
  assert.equal(enforceWindowsQaPrivateAcl(home, { fresh: true }), path.join(home, ".bostan"));
  assert.doesNotThrow(() => enforceWindowsQaPrivateAcl(home));
  // A real app secret inherits precisely from the newly protected parent.
  const secrets = path.join(home, ".bostan", "app", "secrets");
  fs.mkdirSync(secrets, { recursive: true, mode: 0o700 });
  const secret = path.join(secrets, "disposable-secret");
  fs.writeFileSync(secret, "synthetic-do-not-persist", { mode: 0o600 });
  const output = execFileSync("icacls.exe", [secret], { encoding: "utf8" });
  assert.doesNotMatch(output, /Everyone|Authenticated Users|CodexSandboxUsers/i);
}));

onlyWindows("fails closed on injected broad explicit ACL instead of erasing it at restart", () => fixture(home => {
  enforceWindowsQaPrivateAcl(home, { fresh: true });
  const target = path.join(home, ".bostan");
  execFileSync("icacls.exe", [target, "/grant", "*S-1-5-11:(OI)(CI)RX"], { encoding: "utf8" });
  assert.throws(() => enforceWindowsQaPrivateAcl(home), /private ACL check failed/);
  // Only an explicitly new setup may reset the previously unsafe QA tree.
  enforceWindowsQaPrivateAcl(home, { fresh: true });
  assert.doesNotThrow(() => enforceWindowsQaPrivateAcl(home));
}));

onlyWindows("refuses real HOME, external folders, nonexistent targets and link targets", () => {
  assert.throws(() => windowsPrivateAclTarget(os.homedir()), /outside a disposable TEMP HOME/);
  assert.throws(() => windowsPrivateAclTarget(path.join(os.tmpdir(), "nonexistent-qa-home")), /ENOENT/);
  assert.throws(() => windowsPrivateAclTarget("relative"), /Invalid disposable/);
});

test("non-Windows cannot apply any Windows-only ACL action", () => {
  if (process.platform !== "win32") {
    assert.throws(() => windowsPrivateAclTarget(os.tmpdir()), /Windows-only/);
  }
});

onlyWindows("real source launcher refuses preexisting broad ACL before secrets or PG initialization", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-win-launch-acl-"));
  const home = path.join(root, "home");
  const repo = path.join(root, "fake-source");
  const bin = path.join(root, "fake-bin");
  fs.mkdirSync(home);
  fs.mkdirSync(path.join(home, ".bostan"));
  fs.mkdirSync(bin);
  fs.mkdirSync(path.join(repo, "cli"), { recursive: true });
  fs.mkdirSync(path.join(repo, "server", "src"), { recursive: true });
  fs.mkdirSync(path.join(repo, "server", "node_modules", "tsx", "dist"), { recursive: true });
  fs.mkdirSync(path.join(repo, "ui", "dist"), { recursive: true });
  fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({ name: "bostan" }));
  fs.writeFileSync(path.join(repo, "cli", "package.json"), JSON.stringify({ name: "bostan" }));
  for (const file of ["server/src/index.ts", "server/node_modules/tsx/dist/loader.mjs", "ui/dist/index.html"]) {
    fs.writeFileSync(path.join(repo, file), "");
  }
  for (const name of ["initdb", "pg_ctl", "psql", "createdb"]) {
    fs.writeFileSync(path.join(bin, name + ".exe"), "not an executable");
  }
  const prev = { home: process.env.HOME, qa: process.env.BOSTAN_WINDOWS_TEMP_QA, path: process.env.PATH };
  process.env.HOME = home;
  process.env.BOSTAN_WINDOWS_TEMP_QA = "1";
  process.env.PATH = bin + path.delimiter + (prev.path ?? "");
  try {
    await assert.rejects(
      () => runLocalRuntime({ home, repo, port: 41688 }),
      /private ACL check failed/,
    );
    assert.equal(fs.existsSync(path.join(home, ".bostan", "app", "secrets")), false);
    enforceWindowsQaPrivateAcl(home, { fresh: true });
    await assert.rejects(() => runLocalRuntime({ home, repo, port: 41688 }),
      /ENOEXEC|UNKNOWN|EINVAL|not a valid Win32 application|spawn|shutdown/i);
    const privateSecrets = path.join(home, ".bostan", "app", "secrets");
    assert.equal(fs.existsSync(path.join(privateSecrets, "agent-jwt")), true);
    assert.equal(fs.existsSync(path.join(privateSecrets, "db-password")), true);
    assert.equal(fs.existsSync(path.join(home, ".bostan", "app", "run.lock")), false);
    enforceWindowsQaPrivateAcl(home);
  } finally {
    if (prev.home === undefined) delete process.env.HOME; else process.env.HOME = prev.home;
    if (prev.qa === undefined) delete process.env.BOSTAN_WINDOWS_TEMP_QA; else process.env.BOSTAN_WINDOWS_TEMP_QA = prev.qa;
    if (prev.path === undefined) delete process.env.PATH; else process.env.PATH = prev.path;
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 6, retryDelay: 250 });
  }
});
