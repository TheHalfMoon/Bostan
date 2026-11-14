import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(new URL("../package.json", import.meta.url));
export function nsisRegistrationIdentity(pkg) {
  const { UUID } = require("builder-util-runtime");
  // Namespace and default display template belong to pinned builder26.18.0.
  const key = (pkg.build.nsis.guid ?? UUID.v5(pkg.build.appId, UUID.parse("50e065bc-3134-11e6-9bab-38c9862bdaf3"))).replace(/\\/g, " - ");
  const productName = pkg.build.productName ?? pkg.productName;
  const displayName = (pkg.build.nsis.uninstallDisplayName ?? "${productName} ${version}")
    .replaceAll("${productName}", productName).replaceAll("${version}", pkg.version);
  assert.ok(!displayName.includes("${"), "Unsupported installer display-name template");
  return { key, productName, displayName, version: pkg.version, uninstallerName: `Uninstall ${productName}.exe` };
}

export function assertInstalledRegistration(records, expected, directory) {
  assert.ok(Array.isArray(records), "Invalid Windows registration response");
  assert.equal(records.length, 1, "Installer registration is missing or ambiguous");
  const record = records[0];
  assert.ok(record && typeof record === "object" && !Array.isArray(record), "Invalid Windows registration record");
  assert.ok(typeof record.key === "string" && record.key.toLowerCase() === expected.key.toLowerCase()
    && record.displayName === expected.displayName && record.displayVersion === expected.version,
  "Windows registration does not match this application identity and version");
  const quoted = /^"([^"]+)"(?:\s|$)/.exec(record.uninstallString ?? "");
  assert.ok(quoted && path.win32.isAbsolute(quoted[1])
    && path.win32.basename(quoted[1]).toLowerCase() === expected.uninstallerName.toLowerCase()
    && path.win32.dirname(path.win32.normalize(quoted[1])).toLowerCase() === path.win32.resolve(directory).toLowerCase(),
  "Windows registration does not reference the owned installation directory");
}
