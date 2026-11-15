import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const desktop = path.resolve(import.meta.dirname, "..");
const electron = path.join(desktop, "node_modules/electron/dist", fs.readFileSync(path.join(desktop, "node_modules/electron/path.txt"), "utf8").trim());
function fixture() {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "bostan-ci-provider-test-"));
  fs.copyFileSync(fileURLToPath(new URL("./installed-process-provider.mjs", import.meta.url)), path.join(root, "provider.mjs"));
  const issueId = randomUUID(), runId = randomUUID(), companyId = randomUUID();
  fs.writeFileSync(path.join(root, "job.json"), JSON.stringify({ issueId, mode: "artifact" }));
  fs.writeFileSync(path.join(root, "input.txt"), "unknown synthetic content " + randomUUID());
  return { root, issueId, runId, companyId };
}
async function invoke(f, apiUrl) {
  const env = { PATH: process.env.PATH ?? "", ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot, WINDIR: process.env.SystemRoot } : {}),
    HOME: f.root, USERPROFILE: f.root, APPDATA: f.root, LOCALAPPDATA: f.root, TEMP: f.root, TMP: f.root, TMPDIR: f.root,
    ELECTRON_RUN_AS_NODE: "1", BOSTAN_DESKTOP_CI_PROVIDER: "1", PAPERCLIP_API_URL: apiUrl,
    PAPERCLIP_API_KEY: "synthetic-run-token", PAPERCLIP_RUN_ID: f.runId, PAPERCLIP_COMPANY_ID: f.companyId };
  const child = spawn(electron, [path.join(f.root, "provider.mjs")], { cwd: f.root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "", oversized = false, timedOut = false;
  child.stdout.on("data", bytes => { stdout += bytes; if (stdout.length > 8192) { oversized = true; child.kill("SIGKILL"); } });
  child.stderr.on("data", bytes => { stderr += bytes; if (stderr.length > 8192) { oversized = true; child.kill("SIGKILL"); } });
  const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, 20000);
  try {
    const [code] = await once(child, "close");
    assert.equal(timedOut, false); assert.equal(oversized, false);
    return { code, stdout, stderr };
  } finally { clearTimeout(timer); }
}

test("actual embedded Node provider reads/writes unknown bytes and binds authenticated artifact receipts", { timeout: 30000 }, async () => {
  const f = fixture(), attachmentId = randomUUID(), workProductId = randomUUID();
  const received = [], failures = [];
  const server = http.createServer(async (req, res) => {
    try {
      const parts = []; let size = 0;
      for await (const part of req) { size += part.length; assert.ok(size < 16384); parts.push(part); }
      const body = Buffer.concat(parts).toString("utf8");
      assert.equal(req.headers.authorization, "Bearer synthetic-run-token");
      assert.equal(req.headers["x-paperclip-run-id"], f.runId);
      assert.equal(req.method, "POST");
      received.push(req.url);
      res.setHeader("content-type", "application/json");
      if (req.url === `/api/companies/${f.companyId}/issues/${f.issueId}/attachments`) {
        assert.ok(body.includes(fs.readFileSync(path.join(f.root, "input.txt"), "utf8")));
        res.end(JSON.stringify({ id: attachmentId }));
      } else if (req.url === `/api/issues/${f.issueId}/work-products`) {
        const product = JSON.parse(body);
        assert.equal(product.metadata.attachmentId, attachmentId);
        assert.equal(product.createdByRunId, f.runId);
        assert.equal(product.status, "ready_for_review");
        res.end(JSON.stringify({ id: workProductId }));
      } else throw Error("Unexpected provider request");
    } catch { failures.push(true); res.statusCode = 500; res.end("fixture request rejected"); }
  });
  try {
    server.listen(0, "127.0.0.1"); await once(server, "listening");
    const result = await invoke(f, `http://127.0.0.1:${server.address().port}`);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(failures.length, 0); assert.equal(received.length, 2);
    assert.deepEqual(JSON.parse(result.stdout.trim()), { type: "bostan-ci-process-artifact", issueId: f.issueId, runId: f.runId, attachmentId, workProductId });
    assert.equal(fs.readFileSync(path.join(f.root, "artifacts", f.issueId + ".txt"), "utf8"), fs.readFileSync(path.join(f.root, "input.txt"), "utf8"));
    assert.equal((result.stdout + result.stderr).includes("synthetic-run-token"), false);
    const receiptPath = path.join(f.root, "runs", f.runId + ".json");
    const firstReceipt = fs.readFileSync(receiptPath, "utf8");
    assert.equal(JSON.parse(firstReceipt).issueId, f.issueId);
    assert.equal(fs.statSync(receiptPath).nlink, 1);
    const repeated = await invoke(f, `http://127.0.0.1:${server.address().port}`);
    assert.equal(repeated.code, 1);
    assert.equal(repeated.stderr.trim(), "BOSTAN_CI_PROCESS_FAILED");
    assert.equal(fs.readFileSync(receiptPath, "utf8"), firstReceipt, "A duplicate invocation must not replace the authoritative PID receipt");
    assert.equal(fs.existsSync(path.join(f.root, "runs", f.runId + ".tmp")), false);
    assert.equal(received.length, 2, "A duplicate run must not upload another artifact");
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(f.root, { recursive: true, force: false });
  }
});

test("CI provider refuses a non-local API before disclosing its token or creating run output", { timeout: 30000 }, async () => {
  const f = fixture();
  try {
    const result = await invoke(f, "https://example.test/private");
    assert.equal(result.code, 1);
    assert.equal(result.stdout, ""); assert.equal(result.stderr.trim(), "BOSTAN_CI_PROCESS_FAILED");
    assert.equal(fs.existsSync(path.join(f.root, "runs")), false);
  } finally { fs.rmSync(f.root, { recursive: true, force: false }); }
});
