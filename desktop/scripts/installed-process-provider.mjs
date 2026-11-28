// Deterministic CI provider. Exercises real child execution and authenticated
// artifact APIs; it is not an AI model and must never be reported as one.
import fs from "node:fs";
import path from "node:path";

try {
  if (process.env.BOSTAN_DESKTOP_CI_PROVIDER !== "1") throw Error("CI provider disabled");
  const api = new URL(process.env.PAPERCLIP_API_URL);
  if (api.protocol !== "http:" || api.hostname !== "127.0.0.1" || api.username || api.password) throw Error("Non-local API refused");
  const { issueId, mode } = JSON.parse(fs.readFileSync("job.json", "utf8"));
  const runId = process.env.PAPERCLIP_RUN_ID;
  const companyId = process.env.PAPERCLIP_COMPANY_ID;
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  if (![issueId, runId, companyId].every(value => typeof value === "string" && uuid.test(value)) || !process.env.PAPERCLIP_API_KEY) throw Error("Missing run identity");
  fs.mkdirSync("runs", { recursive: true });
  const temporaryReceipt = path.join("runs", runId + ".tmp");
  fs.writeFileSync(temporaryReceipt, JSON.stringify({ pid: process.pid, issueId, mode }), { flag: "wx", mode: 0o600 });
  // Publish complete bytes atomically without replacing another run receipt.
  try { fs.linkSync(temporaryReceipt, path.join("runs", runId + ".json")); }
  finally { fs.unlinkSync(temporaryReceipt); }
  if (mode === "hold") {
    console.log("BOSTAN_CI_PROCESS_WAITING");
    await new Promise(resolve => setTimeout(resolve, 60000));
    throw Error("Expected cancellation or timeout");
  }
  if (mode !== "artifact") throw Error("Unsupported fixture job");
  const bytes = fs.readFileSync("input.txt");
  if (bytes.length < 1 || bytes.length > 4096) throw Error("Invalid fixture input");
  fs.mkdirSync("artifacts", { recursive: true });
  fs.writeFileSync(path.join("artifacts", issueId + ".txt"), bytes, { flag: "wx", mode: 0o600 });
  const headers = { Authorization: "Bearer " + process.env.PAPERCLIP_API_KEY, "X-Paperclip-Run-Id": runId };
  async function request(route, body) {
    const response = await fetch(new URL(route, api), {
      method: "POST", headers: { ...headers, ...(body instanceof FormData ? {} : { "content-type": "application/json" }) },
      body: body instanceof FormData ? body : JSON.stringify(body), signal: AbortSignal.timeout(10000), redirect: "error",
    });
    if (!response.ok) throw Error("Artifact API refused");
    return response.json();
  }
  const multipart = new FormData();
  multipart.set("file", new Blob([bytes], { type: "text/plain" }), "desktop-process-proof.txt");
  const attachment = await request(`/api/companies/${companyId}/issues/${issueId}/attachments`, multipart);
  if (!uuid.test(attachment.id ?? "")) throw Error("Missing attachment receipt");
  const workProduct = await request(`/api/issues/${issueId}/work-products`, {
    type: "artifact", provider: "paperclip", title: "Desktop process proof", status: "ready_for_review",
    createdByRunId: runId, isPrimary: true, metadata: { attachmentId: attachment.id },
  });
  if (!uuid.test(workProduct.id ?? "")) throw Error("Missing work product receipt");
  console.log(JSON.stringify({ type: "bostan-ci-process-artifact", issueId, runId, attachmentId: attachment.id, workProductId: workProduct.id }));
} catch {
  // Never echo the run token, backend response, paths or arbitrary exceptions.
  console.error("BOSTAN_CI_PROCESS_FAILED");
  process.exitCode = 1;
}
