import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { matchesLocalCompiledSourceCommit as matches,
  checkLocalCompiledBuildStamp } from "./bostan-private-local-compiled-stamp.mjs";

const sha = "a".repeat(40);
const actual = Object.freeze({indexSha256: "b".repeat(64), vendorSha256: "c".repeat(64)});
const valid = JSON.stringify({ commit: sha, ...actual }) + "\n";
const sourceFile = fileURLToPath(new URL("./bostan-local-http-postgres-smoke.sh", import.meta.url));
const admissionFile = fileURLToPath(new URL("./bostan-private-local-compiled-stamp.mjs", import.meta.url));

test("exact 40-digit lowercase built commit qualifies only same Git HEAD", () => {
  assert.equal(matches(valid, sha, actual), true);
  assert.equal(matches(valid, "b".repeat(40), actual), false);
  assert.equal(matches(valid, sha.slice(0, 7), actual), false);
  assert.equal(matches(valid, sha.toUpperCase(), actual), false);
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
  ]) assert.equal(matches(value, sha, actual), false);
  assert.equal(matches(valid, 17, actual), false);
  assert.equal(matches(valid, " ".repeat(40), actual), false);
});

test("compiled entry hashes must match both real executable digests", () => {
  assert.equal(matches(valid, sha, undefined), false);
  assert.equal(matches(valid, sha, {indexSha256: actual.indexSha256}), false);
  assert.equal(matches(valid, sha, {...actual, indexSha256: "d".repeat(64)}), false);
  assert.equal(matches(valid, sha, {...actual, vendorSha256: "e".repeat(64)}), false);
  assert.equal(matches(JSON.stringify({commit: sha}), sha, actual), false);
  assert.equal(matches(JSON.stringify({...actual,commit: sha, extra:"unexpected"}), sha, actual), false);
  assert.equal(matches(JSON.stringify({commit: sha,indexSha256:"x",vendorSha256:actual.vendorSha256}), sha, actual), false);
});

test("real checkout admission accepts owned matching bytes and rejects both tampered entries", () => {
  const workspace = mkdtempSync(join(tmpdir(), "bostan-private-stamp-owned-"));
  try {
    const git = (...args) => execFileSync("git", args, {
      cwd: workspace, encoding: "utf8", timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    git("init", "--quiet");
    git("-c", "user.name=QA", "-c", "user.email=test@example.invalid",
      "commit", "--allow-empty", "--no-gpg-sign", "-m", "synthetic");
    const head = git("rev-parse", "HEAD");
    const dist = join(workspace, "server", "dist");
    const vendor = join(dist, "vendor", "paperclip-runner");
    mkdirSync(vendor, {recursive: true});
    const index = join(dist, "index.js");
    const runner = join(vendor, "index.js");
    const indexBytes = "owned-bostan-synthetic-compiled-index";
    const runnerBytes = "owned-bostan-synthetic-compiled-runner";
    writeFileSync(index, indexBytes);
    writeFileSync(runner, runnerBytes);
    const hash = value => createHash("sha256").update(value).digest("hex");
    const stamp = join(dist, "build-info.json");
    writeFileSync(stamp, JSON.stringify({
      commit: head, indexSha256: hash(indexBytes),
      vendorSha256: hash(runnerBytes),
    }) + "\n");
    assert.equal(checkLocalCompiledBuildStamp(workspace), true);
    writeFileSync(index, indexBytes + "-unexpected");
    assert.equal(checkLocalCompiledBuildStamp(workspace), false);
    writeFileSync(index, indexBytes);
    assert.equal(checkLocalCompiledBuildStamp(workspace), true);
    writeFileSync(runner, runnerBytes + "-unexpected");
    assert.equal(checkLocalCompiledBuildStamp(workspace), false);
    writeFileSync(runner, runnerBytes);
    assert.equal(checkLocalCompiledBuildStamp(workspace), true);
    writeFileSync(stamp, JSON.stringify({
      commit: "f".repeat(40), indexSha256: hash(indexBytes),
      vendorSha256: hash(runnerBytes),
    }));
    assert.equal(checkLocalCompiledBuildStamp(workspace), false);
  } finally {
    // Isolated fresh test root only, never the checkout/global package caches.
    rmSync(workspace, {recursive: true, force: true});
  }
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
