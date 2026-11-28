import fs from "node:fs";
import path from "node:path";

function validSegment(segment) {
  return segment.length > 0 && segment !== "." && segment !== ".."
    && !/[\\:\x00-\x1f\x7f]/.test(segment);
}

function validPath(value) {
  return typeof value === "string" && !value.startsWith("/") && value.split("/").every(validSegment);
}

/** Serialize the verified staged runtime into a bounded, path-only verifier manifest. */
export function writeInstallPayloadManifest(entries, destination) {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error("Empty Bostan install payload manifest");
  const seen = new Set();
  const rows = ["BOSTAN_RUNTIME_PAYLOAD_V1"];
  for (const entry of entries) {
    if (!entry || !validPath(entry.path) || /[\t\r\n]/.test(entry.path)) throw new Error("Unsafe Bostan install manifest path");
    const key = entry.path.toLowerCase();
    if (seen.has(key)) throw new Error("Duplicate Bostan install manifest path");
    seen.add(key);
    if (entry.kind === "file" && /^[a-f0-9]{64}$/.test(entry.sha256)) {
      rows.push(`F\t${entry.sha256}\t${entry.path}`);
    } else if (entry.kind === "link" && typeof entry.target === "string"
        && entry.target.length > 0 && !entry.target.startsWith("/") && !entry.target.startsWith("\\")
        && !entry.target.includes("\\") && !/[\x00-\x1f\x7f\t\r\n:]/.test(entry.target)) {
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(entry.path), entry.target));
      if (resolved === ".." || resolved.startsWith("../") || path.posix.isAbsolute(resolved)) throw new Error("Bostan install link escapes payload root");
      rows.push(`L\t${entry.target}\t${entry.path}`);
    } else throw new Error("Unsupported Bostan install manifest entry");
  }
  fs.writeFileSync(destination, rows.join("\n") + "\n", { flag: "wx", mode: 0o600 });
  return { entries: entries.length, bytes: fs.statSync(destination).size };
}
