import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const archiveName = "bostan-declaration-maps.tar";
const manifestName = "bostan-declaration-maps.json";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
function portable(name) {
  return name && /^[\x20-\x7e]+$/.test(name) && !name.includes("\\") && !/[<>:"|?*]/.test(name)
    && !name.startsWith("/") && name.split("/").every(part => part && part !== "." && part !== ".."
      && !/[. ]$/.test(part) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}
function tarPath(name) {
  if (!portable(name)) return null;
  if (Buffer.byteLength(name) <= 100) return { name, prefix: "" };
  for (let n = name.lastIndexOf("/"); n > 0; n = name.lastIndexOf("/", n - 1)) {
    const prefix = name.slice(0, n), leaf = name.slice(n + 1);
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(leaf) <= 100) return { name: leaf, prefix };
  }
  return null;
}
function header(name, size) {
  const split = tarPath(name); assert.ok(split, "Unrepresentable declaration-map path");
  const block = Buffer.alloc(512);
  block.write(split.name, 0, 100, "utf8"); block.write(split.prefix, 345, 155, "utf8");
  for (const [offset, length, value] of [[100, 8, 0o644], [108, 8, 0], [116, 8, 0], [124, 12, size], [136, 12, 0]]) {
    block.write(value.toString(8).padStart(length - 1, "0") + "\0", offset, length, "ascii");
  }
  block.fill(32, 148, 156); block[156] = 48;
  block.write("ustar\0", 257, 6, "ascii"); block.write("00", 263, 2, "ascii");
  const checksum = block.reduce((total, byte) => total + byte, 0);
  block.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "ascii");
  return block;
}
function octal(block, offset, length) {
  const value = block.subarray(offset, offset + length).toString("ascii").replace(/\0.*$/, "").trim();
  assert.match(value, /^[0-7]+$/, "Invalid declaration-map archive number");
  return parseInt(value, 8);
}
function readExact(fd, size, offset) {
  const bytes = Buffer.alloc(size); let received = 0;
  while (received < size) {
    const count = fs.readSync(fd, bytes, received, size - received, offset + received);
    assert.ok(count > 0, "Truncated declaration-map archive"); received += count;
  }
  return bytes;
}
/** Verify our deliberately narrow regular-file USTAR format without extracting. */
export function verifyDeclarationMapArchive(filename, entries) {
  assert.equal(new Set(entries.map(item => item.path)).size, entries.length, "Duplicate declaration-map paths");
  for (const item of entries) {
    assert.ok(portable(item.path) && /\.d\.[cm]?ts\.map$/.test(item.path));
    assert.ok(Number.isSafeInteger(item.size) && item.size >= 0 && item.size <= 16 * 1024 * 1024);
    assert.match(item.sha256, /^[a-f0-9]{64}$/);
  }
  const fd = fs.openSync(filename, "r");
  try {
    let offset = 0;
    for (const expected of entries) {
      const block = readExact(fd, 512, offset); offset += 512;
      const actualChecksum = octal(block, 148, 8);
      const checksumBlock = Buffer.from(block); checksumBlock.fill(32, 148, 156);
      assert.equal(checksumBlock.reduce((total, byte) => total + byte, 0), actualChecksum);
      assert.equal(block[156], 48); assert.equal(block.subarray(257, 263).toString(), "ustar\0");
      const string = (start, length) => block.subarray(start, start + length).toString("utf8").replace(/\0.*$/, "");
      const prefix = string(345, 155), name = (prefix ? prefix + "/" : "") + string(0, 100);
      assert.ok(portable(name)); assert.equal(name, expected.path);
      assert.equal(octal(block, 100, 8), 0o644); assert.equal(octal(block, 108, 8), 0);
      assert.equal(octal(block, 116, 8), 0); assert.equal(octal(block, 136, 12), 0);
      const size = octal(block, 124, 12); assert.equal(size, expected.size);
      assert.equal(digest(readExact(fd, size, offset)), expected.sha256);
      const padding = (512 - size % 512) % 512;
      assert.ok(readExact(fd, padding, offset + size).every(byte => byte === 0));
      offset += size + padding;
    }
    assert.ok(readExact(fd, 1024, offset).every(byte => byte === 0));
    assert.equal(fs.fstatSync(fd).size, offset + 1024, "Unexpected declaration-map archive entries");
  } finally { fs.closeSync(fd); }
}

/** Relocate optional declaration navigation maps only in an owned build stage.
 * Executable JavaScript maps, declarations, source, native and legal files stay loose. */
export function archiveDeclarationMaps(stage) {
  assert.equal(fs.realpathSync(stage), path.resolve(stage));
  const archive = path.join(stage, archiveName), manifest = path.join(stage, manifestName);
  for (const target of [archive, manifest, archive + ".tmp", manifest + ".tmp"]) {
    assert.equal(fs.lstatSync(target, { throwIfNoEntry: false }), undefined, "Occupied declaration-map output");
  }
  const selected = [];
  function visit(directory) {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, item.name), stat = fs.lstatSync(filename);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) { visit(filename); continue; }
      if (!stat.isFile() || stat.nlink !== 1 || stat.size > 16 * 1024 * 1024 || !/\.d\.[cm]?ts\.map$/.test(item.name)) continue;
      const name = path.relative(stage, filename).split(path.sep).join("/");
      if (!tarPath(name)) continue;
      const adjacent = fs.lstatSync(filename.slice(0, -4), { throwIfNoEntry: false });
      if (!adjacent?.isFile() || adjacent.isSymbolicLink()) continue;
      const bytes = fs.readFileSync(filename); let value;
      try { value = JSON.parse(bytes); } catch { continue; }
      if (value?.version !== 3 || !Array.isArray(value.sources) || !value.sources.every(source => typeof source === "string")
          || !Array.isArray(value.names)
          || typeof value.mappings !== "string" || value.sections !== undefined) continue;
      selected.push({ path: name, size: bytes.length, sha256: digest(bytes), filename, stat });
    }
  }
  visit(stage); selected.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  if (!selected.length) return { archived: 0, bytes: 0 };
  const entries = selected.map(({ path: name, size, sha256 }) => ({ path: name, size, sha256 }));
  const fd = fs.openSync(archive + ".tmp", "wx", 0o600);
  try {
    for (const item of selected) {
      const bytes = fs.readFileSync(item.filename); assert.equal(digest(bytes), item.sha256, "Declaration map changed during archival");
      fs.writeFileSync(fd, header(item.path, item.size)); fs.writeFileSync(fd, bytes);
      fs.writeFileSync(fd, Buffer.alloc((512 - item.size % 512) % 512));
    }
    fs.writeFileSync(fd, Buffer.alloc(1024)); fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  verifyDeclarationMapArchive(archive + ".tmp", entries);
  fs.writeFileSync(manifest + ".tmp", JSON.stringify({ schema: "bostan.declaration-maps.v1", archive: archiveName, entries }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  // Verify every loose identity and byte before publishing or removing any map.
  for (const item of selected) {
    const stat = fs.lstatSync(item.filename);
    assert.ok(stat.isFile() && stat.nlink === 1 && stat.dev === item.stat.dev && stat.ino === item.stat.ino);
    assert.equal(digest(fs.readFileSync(item.filename)), item.sha256);
  }
  fs.renameSync(archive + ".tmp", archive); fs.renameSync(manifest + ".tmp", manifest);
  for (const item of selected) fs.unlinkSync(item.filename);
  return { archived: entries.length, bytes: entries.reduce((total, item) => total + item.size, 0) };
}
