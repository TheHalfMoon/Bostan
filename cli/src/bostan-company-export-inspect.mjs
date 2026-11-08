/**
 * Offline, bounded, read-only inspection of archives produced by Bostan's
 * browser-side createZipArchive. This is NOT an import, ZIP extraction,
 * remote URL reader, database preview or credential parser.
 */
import { closeSync, fstatSync, lstatSync, openSync, readSync } from "node:fs";
import { resolve } from "node:path";

const MAX_BYTES = 64 * 1024 * 1024;
const MAX_ENTRIES = 2_000;
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const u16 = (bytes, offset) => bytes.readUInt16LE(offset);
const u32 = (bytes, offset) => bytes.readUInt32LE(offset);
const typeNames = ["agents", "projects", "tasks", "skills", "images", "other"];

function invalid() { throw new Error("Invalid or unsupported Bostan local company ZIP export"); }
function within(bytes, offset, length) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) ||
      offset < 0 || length < 0 || offset + length > bytes.length) invalid();
}
function crc32(bytes) {
  let value = 0xffffffff;
  for (const b of bytes) {
    value ^= b;
    for (let i = 0; i < 8; i++) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  }
  return (value ^ 0xffffffff) >>> 0;
}
function safeName(bytes) {
  let name;
  try { name = decoder.decode(bytes); } catch { invalid(); }
  if (!name || name.length > 1024 || name.startsWith("/") || name.includes("\\") ||
      /[\u0000-\u001f\u007f:]/.test(name) ||
      name.split("/").some(part => !part || part === "." || part === "..")) invalid();
  return name;
}

export function inspectBostanCompanyExportArchive(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 22 || bytes.length > MAX_BYTES) invalid();
  const end = bytes.length - 22;
  if (u32(bytes, end) !== 0x06054b50 || u16(bytes, end + 4) !== 0 ||
      u16(bytes, end + 6) !== 0 || u16(bytes, end + 20) !== 0) invalid();
  const count = u16(bytes, end + 10);
  if (count === 0 || count > MAX_ENTRIES || u16(bytes, end + 8) !== count) invalid();
  const centralSize = u32(bytes, end + 12);
  const centralStart = u32(bytes, end + 16);
  if (centralStart + centralSize !== end) invalid();
  let central = centralStart;
  let local = 0;
  let root = null;
  let hasReadme = false;
  const names = new Set();
  const categories = Object.fromEntries(typeNames.map(name => [name, 0]));
  let totalContentBytes = 0;

  for (let i = 0; i < count; i++) {
    within(bytes, central, 46);
    if (u32(bytes, central) !== 0x02014b50 ||
        u16(bytes, central + 8) !== 0x0800 || u16(bytes, central + 10) !== 0) invalid();
    const crc = u32(bytes, central + 16);
    const size = u32(bytes, central + 20);
    if (size !== u32(bytes, central + 24) || size > MAX_BYTES) invalid();
    const nameSize = u16(bytes, central + 28);
    if (!nameSize || u16(bytes, central + 30) || u16(bytes, central + 32) ||
        u16(bytes, central + 34) || u16(bytes, central + 36) ||
        u32(bytes, central + 38) || u32(bytes, central + 42) !== local) invalid();
    within(bytes, central + 46, nameSize);
    const rawName = bytes.subarray(central + 46, central + 46 + nameSize);
    const name = safeName(rawName);
    if (names.has(name)) invalid();
    names.add(name);
    const segments = name.split("/");
    if (segments.length < 2) invalid();
    if (root === null) root = segments[0];
    else if (segments[0] !== root) invalid();
    const relative = segments.slice(1).join("/");
    if (relative === "README.md") hasReadme = true;
    const category = typeNames.includes(segments[1]) && segments[1] !== "other"
      ? segments[1] : "other";
    categories[category] += 1;
    within(bytes, local, 30);
    if (u32(bytes, local) !== 0x04034b50 ||
        u16(bytes, local + 6) !== 0x0800 || u16(bytes, local + 8) !== 0 ||
        u32(bytes, local + 14) !== crc || u32(bytes, local + 18) !== size ||
        u32(bytes, local + 22) !== size || u16(bytes, local + 26) !== nameSize ||
        u16(bytes, local + 28) !== 0) invalid();
    const body = local + 30 + nameSize;
    within(bytes, local + 30, nameSize);
    if (!bytes.subarray(local + 30, body).equals(rawName)) invalid();
    within(bytes, body, size);
    if (crc32(bytes.subarray(body, body + size)) !== crc) invalid();
    local = body + size;
    if (local > centralStart) invalid();
    central += 46 + nameSize;
    totalContentBytes += size;
  }
  if (central !== end || local !== centralStart) invalid();
  return Object.freeze({
    schema: "bostan.local-export-inspect.v1",
    inspection: "offline-read-only-archive-integrity",
    supportedForImport: false,
    archiveValid: true,
    files: count,
    bytes: totalContentBytes,
    hasReadme,
    categories,
  });
}

export function inspectLocalBostanCompanyExport(file) {
  if (typeof file !== "string" || !file.trim() ||
      /^(?:https?:|git:|file:)/i.test(file)) {
    throw new Error("Provide an existing local ZIP file; network URLs are unsupported");
  }
  const target = resolve(file);
  if (!target.toLowerCase().endsWith(".zip")) {
    throw new Error("Provide a local .zip export");
  }
  let fd;
  let original;
  try {
    original = lstatSync(target);
    if (!original.isFile() || original.isSymbolicLink() ||
        original.size < 22 || original.size > MAX_BYTES) invalid();
    fd = openSync(target, "r");
  } catch {
    throw new Error("Bostan local export ZIP is unavailable or unsafe");
  }
  try {
    const stat = fstatSync(fd);
    // Avoid following a file replaced with a symlink between lstat and open.
    if (!stat.isFile() || stat.dev !== original.dev || stat.ino !== original.ino ||
        stat.size !== original.size || stat.size > MAX_BYTES) invalid();
    const bytes = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (!count) invalid();
      offset += count;
    }
    return inspectBostanCompanyExportArchive(bytes);
  } finally { closeSync(fd); }
}
