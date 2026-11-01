import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { matchesLocalCompiledSourceCommit as matches } from "./bostan-private-local-compiled-stamp.mjs";

const sha = "a".repeat(40);
const valid = JSON.stringify({ commit: sha }) + "\n";
const sourceFile = fileURLToPath(new URL("./bostan-local-http-postgres-smoke.sh", import.meta.url));
const admissionFile = fileURLToPath(new URL("./bostan-private-local-compiled-stamp.mjs", import.meta.url));

test("exact 40-digit lowercase built commit qualifies only same Git HEAD", () => {
  assert.equal(matches(valid, sha), true);
  assert.equal(matches(valid, "b".repeat(40)), false);
  assert.equal(matches(valid, sha.slice(0, 7)), false);
  assert.equal(matches(valid, sha.toUpperCase()), false);
});

test("invalid, ambiguous or oversized build-info never qualifies", () => {
  for (const value of [
    "", "{", "null", "[]", '"abc"', "{}", JSON.stringify({ commit: 42 }),
    JSON.stringify({ commit: "a".repeat(7) }),
    JSON.stringify({ commit: "A".repeat(40) }),
    JSON.stringify({ commit: sha + "\n" }),
    JSON.stringify({ commit: sha, additional: "untrusted" }),
    JSON.stringify({ __proto__: "ignored", commit: sha, extra: true }),
    " ".repeat(257) + valid,
    7, null, undefined,
  ]) assert.equal(matches(value, sha), false);
  assert.equal(matches(valid, 17), false);
  assert.equal(matches(valid, " ".repeat(40)), false);
});

test("compiled and packed private smoke reject stale build before mktemp, source mode unaffected", () => {
  const shell = readFileSync(sourceFile, "utf8");
  const marker = 'node "$REPO/scripts/bostan-private-local-compiled-stamp.mjs" --check';
  const location = shell.indexOf(marker);
  assert.ok(location > 0);
  assert.ok(location < shell.indexOf('TMP="$(mktemp -d "$TMP_ROOT/bostan-live-http.'));
  assert.ok(location > shell.indexOf('MODE="$1"'));
  assert.match(shell.slice(0, location), /--run-dist-authz/);
  assert.match(shell.slice(0, location), /--run-packed-authz/);
  assert.match(shell, /node --import tsx src\/index\.ts/);
});

test("unknown or planless compiled stamp CLI requests fail without printing paths or secrets", () => {
  for (const args of [[], ["--publish"], ["--check", "--extra"]]) {
    const v = spawnSync(process.execPath, [admissionFile, ...args], {
      encoding: "utf8", timeout: 4000,
    });
    assert.equal(v.status, 2);
    assert.equal(v.stdout, "");
    assert.match(v.stderr, /^BOSTAN_LOCAL_COMPILED_SOURCE_COMMIT_REFUSED\n$/);
  }
});
