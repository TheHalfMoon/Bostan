import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { isOwnedProbeDirectory } from "./bostan-windows-embedded-postgres-node-probe.mjs";

test("PostgreSQL node probe cleanup is limited to its dedicated temp child", () => {
  const tempRoot = path.resolve("C:/runner/temp");
  assert.equal(isOwnedProbeDirectory(path.join(tempRoot, "bostan-postgres-node-probe-abcd-"), tempRoot), true);
  assert.equal(isOwnedProbeDirectory(tempRoot, tempRoot), false);
  assert.equal(isOwnedProbeDirectory(path.join(tempRoot, "other-data"), tempRoot), false);
  assert.equal(isOwnedProbeDirectory(path.join(tempRoot, "bostan-postgres-node-probe-abcd-", "nested"), tempRoot), false);
  assert.equal(isOwnedProbeDirectory(path.resolve(tempRoot, "..", "outside", "bostan-postgres-node-probe-abcd-"), tempRoot), false);
});
