import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const rootPackage = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const scripts = rootPackage.scripts;
const tests = Object.freeze([
  "scripts/bostan-private-workflow-admission.test.mjs",
  "scripts/bostan-private-preflight.test.mjs",
  "scripts/bostan-private-docs-entry-gate.test.mjs",
  "scripts/bostan-private-ui-brand-gate.test.mjs",
]);

test("private admission workflow preserves the unpublished package identity", () => {
  assert.equal(rootPackage.name, "bostan");
  assert.equal(rootPackage.private, true);
  assert.equal(scripts.release, "node scripts/bostan-release-disabled.mjs");
  assert.equal(scripts["build:npm"], "node scripts/bostan-release-disabled.mjs");
});

test("all source admission tests are directly named without glob ambiguity", () => {
  assert.equal(scripts["test:bostan-admission"], "node --test " + tests.join(" "));
  assert.equal(new Set(tests).size, tests.length);
});

for (const mode of ["test:run", "test:run:general", "test:run:serialized"]) {
  test(mode + " executes private admission before any workspace or Vitest work", () => {
    const command = scripts[mode];
    const expectedPrefix =
      "node scripts/bostan-private-preflight.mjs && pnpm run test:bostan-admission && ";
    assert.ok(command.startsWith(expectedPrefix), command);
    assert.ok(command.includes("pnpm run preflight:workspace-links &&"), command);
    assert.ok(command.includes("node scripts/run-vitest-stable.mjs"), command);
  });
}

test("default test command still delegates to admitted test:run", () => {
  assert.equal(scripts.test, "pnpm run test:run");
});

test("WebSocket wire qualification remains explicit until source-native Node 24 QA", () => {
  assert.equal(
    scripts["test:bostan-upgrade-wire"],
    "node --experimental-strip-types --test scripts/bostan-private-upgrade-wire.test.mjs",
  );
  assert.ok(!scripts["test:bostan-admission"].includes("upgrade-wire"));
});
