import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

// Cover exactly the complete candidate installers and their fixed metadata.
// Differential blockmaps are not distributed or qualified by this build.
export async function writeCandidateChecksums(outputDirectory, artifacts) {
  const root = fs.realpathSync(outputDirectory);
  const files = new Set();
  for (const artifact of [...artifacts, path.join(root, "bostan-sbom.cdx.json"), path.join(root, "bostan-license-inventory.json")]) {
    const input = path.resolve(artifact);
    if (fs.realpathSync(path.dirname(input)) !== root || /[\r\n]/.test(path.basename(input))) throw new Error("Unexpected candidate artifact path");
    const file = path.join(root, path.basename(input));
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) throw new Error("Linked candidate artifact refused");
    if (stat.isDirectory() || file.endsWith(".blockmap")) continue;
    if (!stat.isFile() || stat.nlink !== 1) throw new Error("Unsafe candidate artifact");
    if (!/\.(?:exe|dmg)$/.test(file) && !["bostan-sbom.cdx.json", "bostan-license-inventory.json"].includes(path.basename(file))) throw new Error("Unexpected candidate artifact type");
    files.add(file);
  }
  const checksums = [];
  for (const file of [...files].sort()) {
    const hash = createHash("sha256");
    for await (const bytes of fs.createReadStream(file)) hash.update(bytes);
    checksums.push(`${hash.digest("hex")}  ${path.basename(file)}`);
  }
  const temporary = path.join(root, `.SHA256SUMS-${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, checksums.join("\n") + "\n", { flag: "wx" });
    fs.renameSync(temporary, path.join(root, "SHA256SUMS"));
  } finally {
    try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}

export async function verifyCandidateArtifact(outputDirectory, filename) {
  const root = fs.realpathSync(outputDirectory);
  if (path.basename(filename) !== filename || /[\r\n]/.test(filename)) throw new Error("Unexpected candidate artifact name");
  const manifest = path.join(root, "SHA256SUMS");
  const manifestStat = fs.lstatSync(manifest);
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.nlink !== 1) throw new Error("Unsafe candidate checksum manifest");
  const descriptor = fs.openSync(manifest, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  let content;
  try {
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || opened.nlink !== 1) throw new Error("Unsafe candidate checksum manifest");
    const bytes = Buffer.alloc(65537);
    let count = 0;
    while (count < bytes.length) {
      const read = fs.readSync(descriptor, bytes, count, bytes.length - count, count);
      if (read === 0) break;
      count += read;
    }
    if (count > 65536) throw new Error("Oversized candidate checksum manifest");
    content = bytes.subarray(0, count).toString("utf8");
  } finally { fs.closeSync(descriptor); }
  const matches = [];
  for (const line of content.trimEnd().split(/\r?\n/)) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    if (!match || path.basename(match[2]) !== match[2]) throw new Error("Malformed candidate checksum manifest");
    if (match[2] === filename) matches.push(match[1]);
  }
  if (matches.length !== 1) throw new Error("Candidate checksum is missing or ambiguous");
  const file = path.join(root, filename);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error("Unsafe candidate artifact");
  const hash = createHash("sha256");
  for await (const bytes of fs.createReadStream(file)) hash.update(bytes);
  if (hash.digest("hex") !== matches[0]) throw new Error("Candidate artifact checksum mismatch");
}

export async function verifyCandidateInstall(outputDirectory, filename) {
  for (const name of [filename, "bostan-sbom.cdx.json", "bostan-license-inventory.json"]) {
    await verifyCandidateArtifact(outputDirectory, name);
  }
}
