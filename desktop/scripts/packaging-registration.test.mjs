import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { nsisRegistrationIdentity, assertInstalledRegistration } from "./windows-registration-identity.mjs";
import { resolvePrivateWindowsPowerShellBinary } from "../../scripts/bostan-private-windows-powershell-binary.mjs";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const identity = nsisRegistrationIdentity(pkg);
const directory = "C:\\owned-fixture\\application";
const record = { key: identity.key, displayName: identity.displayName, displayVersion: identity.version,
  uninstallString: `"${directory}\\Uninstall Bostan.exe" /currentuser` };

test("NSIS registration uses the pinned builder identity and its versioned default display name", () => {
  assert.equal(identity.productName, "Bostan");
  assert.equal(identity.displayName, "Bostan " + pkg.version);
  assert.match(identity.key, /^[a-f0-9-]{36}$/i);
  const overridden = nsisRegistrationIdentity({ ...pkg, build: { ...pkg.build, nsis: { ...pkg.build.nsis,
    guid: "78b916d8-05c5-4b78-952f-e4158113737b", uninstallDisplayName: "${productName}" } } });
  assert.equal(overridden.key, "78b916d8-05c5-4b78-952f-e4158113737b");
  assert.equal(overridden.displayName, "Bostan");
});

test("registration qualification accepts this version and refuses missing or duplicate entries", () => {
  assertInstalledRegistration([record], identity, directory);
  assert.throws(() => assertInstalledRegistration([], identity, directory), /missing or ambiguous/);
  assert.throws(() => assertInstalledRegistration([record, record], identity, directory), /missing or ambiguous/);
});

test("registration qualification refuses foreign identity, stale version and an external uninstaller", () => {
  for (const change of [{ key: randomUUID() }, { displayVersion: "unrelated" }, { displayName: "Bostan" },
    { uninstallString: `"${directory}\\Bostan.exe" /currentuser` },
    { uninstallString: '"C:\\outside\\Uninstall Bostan.exe" /currentuser' }, { uninstallString: "unquoted.exe" }]) {
    assert.throws(() => assertInstalledRegistration([{ ...record, ...change }], identity, directory));
  }
});

test("Windows registration reader returns an empty array for an unknown identity without writing the registry", { skip: process.platform !== "win32" }, () => {
  const unknown = randomUUID();
  const result = spawnSync(resolvePrivateWindowsPowerShellBinary(), ["-NoProfile", "-NonInteractive", "-File",
    fileURLToPath(new URL("./read-windows-registration.ps1", import.meta.url))], {
    env: { ...process.env, BOSTAN_QA_UNINSTALL_KEY: unknown, BOSTAN_QA_PRODUCT_NAME: unknown, BOSTAN_QA_DISPLAY_NAME: unknown },
    encoding: "utf8", windowsHide: true, timeout: 15000, maxBuffer: 8192,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), []);
});
