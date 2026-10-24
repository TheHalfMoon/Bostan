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
