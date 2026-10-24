import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { databaseStatus, inspectRuntimeLock, RUNTIME_MARKER } from "./bostan-runtime-recovery.mjs";

const MAX_FILES = 100_000;
const MAX_BYTES = 20 * 1024 ** 3;
const MAX_MANIFEST_BYTES = 32 * 1024 ** 2;
const FORMAT = "bostan-cold-backup-v1";

function owned(target, type) {
  let stat;
  try { stat = fs.lstatSync(target); }
  catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  if (stat.isSymbolicLink() || (type === "dir" && !stat.isDirectory())
    || (type === "file" && (!stat.isFile() || stat.nlink !== 1))
    || (typeof process.getuid === "function" && stat.uid !== process.getuid())) {
    throw new Error("Unsafe Bostan backup filesystem entry: " + target);
  }
  return stat;
}
function mustDir(p) {
  if (!owned(p, "dir")) throw new Error("Bostan backup directory missing: " + p);
}
function safeName(name) {
  if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\\")
    || name.includes("\0")) throw new Error("Unsafe Bostan backup entry name");
  return name;
}
function requireHome(home) {
  if (!home || !path.isAbsolute(home) || path.normalize(home) !== home || home === path.parse(home).root) {
    throw new Error("Use a normalized absolute non-root Bostan HOME");
  }
  return home;
}
function shaFile(filename) {
  // Synchronous bounded single-file hashing avoids introducing network or
  // additional dependencies into a private backup/recovery path.
  const hash = createHash("sha256");
  const fd = fs.openSync(filename, "r");
  try {
    const buffer = Buffer.allocUnsafe(128 * 1024);
    for (;;) {
      const n = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (!n) return hash.digest("hex");
      hash.update(buffer.subarray(0, n));
    }
  } finally { fs.closeSync(fd); }
}
function collect(root, relative = "", entries = [], budget = { count: 0, size: 0 }, skipRuntimeLock = false) {
  for (const name of fs.readdirSync(path.join(root, relative)).sort()) {
    safeName(name);
    if (!relative && name === "run.lock" && skipRuntimeLock) continue;
    const rel = relative ? relative + "/" + name : name;
    const location = path.join(root, rel);
    const stat = fs.lstatSync(location);
    if (stat.isSymbolicLink() || (typeof process.getuid === "function" && stat.uid !== process.getuid())) {
      throw new Error("Symlink or foreign-owned Bostan app entry: " + rel);
    }
    if (++budget.count > MAX_FILES) throw new Error("Bostan backup file-count limit exceeded");
    if (stat.isDirectory()) {
      entries.push({ path: rel, type: "dir" });
      collect(root, rel, entries, budget, skipRuntimeLock);
    } else if (stat.isFile() && stat.nlink === 1) {
      budget.size += stat.size;
      if (!Number.isSafeInteger(stat.size) || budget.size > MAX_BYTES) {
        throw new Error("Bostan backup size limit exceeded");
      }
      entries.push({ path: rel, type: "file", size: stat.size, sha256: shaFile(location) });
    } else throw new Error("Special or hard-linked Bostan app entry: " + rel);
  }
  return entries;
}
function scan(root, skipRuntimeLock = false) {
  return collect(root, "", [], { count: 0, size: 0 }, skipRuntimeLock);
}
function filesEqual(expected, actual) {
  if (expected.length !== actual.length) return false;
  const a = new Map(expected.map(e => [e.path, e]));
  for (const e of actual) {
    const x = a.get(e.path);
    if (!x || x.type !== e.type || (e.type === "file"
      && (x.size !== e.size || x.sha256 !== e.sha256))) return false;
  }
  return true;
}
function copyEntries(source, destination, entries) {
  for (const item of entries) {
    const from = path.join(source, item.path);
    const to = path.join(destination, item.path);
    if (item.type === "dir") {
      if (!owned(from, "dir")) throw new Error("Directory disappeared during Bostan backup");
      fs.mkdirSync(to, { mode: 0o700 });
    } else {
      if (!owned(from, "file")) throw new Error("File disappeared during Bostan backup");
      fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
      fs.chmodSync(to, 0o600);
      const stat = fs.lstatSync(to);
      if (stat.size !== item.size || shaFile(to) !== item.sha256) {
        throw new Error("Bostan file changed during backup: " + item.path);
      }
    }
  }
}
function appHome(home) {
  return path.join(home, ".bostan", "app");
}
function verifyAppIdentity(app) {
  const config = path.join(app, "state", "instances", "local", "config.json");
  if (!owned(config, "file")) throw new Error("Not a Bostan-managed local application");
  const parsed = JSON.parse(fs.readFileSync(config, "utf8"));
  if (parsed?.bostanManagedLocalRuntime !== RUNTIME_MARKER) {
    throw new Error("Refusing a non-Bostan-managed application");
  }
}
/**
 * A restored app must never open its old installation's secret key or storage
 * path. Rewrite ONLY the launcher-owned absolute config fields, not arbitrary
 * user model paths or strings stored in the database.
 */
function rebaseManagedConfig(sourceApp, targetApp) {
  const configFile = path.join(targetApp, "state", "instances", "local", "config.json");
  const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
  if (config?.bostanManagedLocalRuntime !== RUNTIME_MARKER) {
    throw new Error("Refusing to rewrite an unmanaged Bostan configuration");
  }
  const keys = [
    ["database", "backup", "dir"],
    ["logging", "logDir"],
    ["storage", "localDisk", "baseDir"],
    ["secrets", "localEncrypted", "keyFilePath"],
  ];
  let changed = false;
  for (const keyPath of keys) {
    let parent = config;
    for (const key of keyPath.slice(0, -1)) parent = parent?.[key];
    if (!parent || typeof parent !== "object") continue;
    const leaf = keyPath[keyPath.length - 1];
    const value = parent[leaf];
    if (value === undefined || value === null) continue;
    if (typeof value !== "string" || !path.isAbsolute(value)
      || !(value === sourceApp || value.startsWith(sourceApp + path.sep))) {
      throw new Error("Unsafe external or invalid managed path in restored Bostan configuration: " + keyPath.join("."));
    }
    parent[leaf] = targetApp + value.slice(sourceApp.length);
    changed = true;
  }
  if (!changed) return;
  const temp = configFile + ".tmp-" + randomBytes(5).toString("hex");
  try {
    fs.writeFileSync(temp, JSON.stringify(config, null, 2) + "\n",
      { flag: "wx", mode: 0o600 });
    fs.renameSync(temp, configFile);
  } finally { fs.rmSync(temp, { force: true }); }
}

function stopped(app, pgCtl, allowUninitialized = false) {
  const state = databaseStatus(pgCtl, path.join(app, "postgres", "data"));
  if (state !== "stopped" && !(allowUninitialized && state === "not-initialized")) {
    throw new Error("Bostan cold snapshot requires PostgreSQL stopped; actual status: " + state);
  }
}
function snapshotLock(app) {
  const name = path.join(app, "run.lock");
  if (inspectRuntimeLock(name).state !== "absent") {
    throw new Error("Stop Bostan and resolve its runtime lock before creating a backup");
  }
  const contents = RUNTIME_MARKER + ":" + process.pid + "\n";
  fs.writeFileSync(name, contents, { flag: "wx", mode: 0o600 });
  return () => {
    if (fs.readFileSync(name, "utf8") !== contents) {
      throw new Error("Bostan snapshot lock changed; manual inspection required");
    }
    fs.unlinkSync(name);
  };
}
export function verifyColdSnapshot(backup) {
  mustDir(backup);
  const manifestFile = path.join(backup, "manifest.json");
  const payload = path.join(backup, "payload");
  const stat = owned(manifestFile, "file");
  if (!stat || stat.size > MAX_MANIFEST_BYTES) throw new Error("Invalid Bostan backup manifest");
  mustDir(payload);
  if (fs.readdirSync(backup).sort().join(",") !== "manifest.json,payload") {
    throw new Error("Unexpected files in Bostan backup");
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  if (manifest?.format !== FORMAT || typeof manifest.sourceApp !== "string"
    || !path.isAbsolute(manifest.sourceApp) || path.normalize(manifest.sourceApp) !== manifest.sourceApp
    || !manifest.sourceApp.endsWith(path.join(".bostan", "app"))
    || !Array.isArray(manifest.entries) || manifest.entries.length > MAX_FILES) throw new Error("Unsupported Bostan backup format");
  const seen = new Set();
  for (const e of manifest.entries) {
    if (!e || typeof e.path !== "string" || e.path.split("/").some(n => !n || safeName(n) !== n)
      || seen.has(e.path) || !["file", "dir"].includes(e.type)) {
      throw new Error("Invalid Bostan backup manifest path or duplicate");
    }
    seen.add(e.path);
    if (e.type === "file" && (!Number.isSafeInteger(e.size) || e.size < 0
      || !/^[a-f0-9]{64}$/.test(e.sha256))) throw new Error("Invalid Bostan backup digest");
  }
  if (!filesEqual(manifest.entries, scan(payload))) {
    throw new Error("Bostan backup integrity verification failed");
  }
  verifyAppIdentity(payload);
  if (owned(path.join(payload, "run.lock"), "file")
    || owned(path.join(payload, "postgres", "data", "postmaster.pid"), "file")) {
    throw new Error("Bostan cold backup contains an active runtime marker");
  }
  return { files: manifest.entries.length, totalBytes: manifest.entries.reduce((sum,e) => sum + (e.size ?? 0), 0), manifest };
}

export function createColdSnapshot({ home = process.env.HOME || os.homedir(), pgCtl }) {
  requireHome(home);
  mustDir(home);
  const product = path.join(home, ".bostan");
  mustDir(product);
  const app = appHome(home);
  mustDir(app);
  mustDir(path.join(app, "postgres"));
  mustDir(path.join(app, "postgres", "data"));
  verifyAppIdentity(app);
  stopped(app, pgCtl);
  const backups = path.join(product, "backups");
  if (!owned(backups, "dir")) fs.mkdirSync(backups, { mode: 0o700 });
  mustDir(backups);

  const unlock = snapshotLock(app);
  const id = new Date().toISOString().replaceAll(/[-:.]/g, "").replace("T", "-").replace("Z", "") +
    "-" + randomBytes(5).toString("hex");
  const destination = path.join(backups, id);
  const partial = path.join(backups, ".partial-" + id);
  let complete = false;
  try {
    fs.mkdirSync(partial, { mode: 0o700 });
    fs.mkdirSync(path.join(partial, "payload"), { mode: 0o700 });
    const entries = scan(app, true); // The snapshot lock serializes this operation but is never copied.
    copyEntries(app, path.join(partial, "payload"), entries);
    if (!filesEqual(entries, scan(path.join(partial, "payload")))) {
      throw new Error("Bostan snapshot changed during copy");
    }
    stopped(app, pgCtl);
    const manifest = { format: FORMAT, sourceApp: app, createdAt: new Date().toISOString(), entries };
    fs.writeFileSync(path.join(partial, "manifest.json"), JSON.stringify(manifest) + "\n",
      { flag: "wx", mode: 0o600 });
    verifyColdSnapshot(partial);
    if (owned(destination, "dir")) throw new Error("Bostan snapshot destination exists");
    fs.renameSync(partial, destination);
    complete = true;
    return { path: destination, files: entries.length };
  } finally {
    if (!complete && owned(partial, "dir")) fs.rmSync(partial, { recursive: true });
    unlock();
  }
}

/** Restore to a deliberately NEW HOME; never overwrite any existing user data. */
export function restoreColdSnapshot({ backup, targetHome }) {
  if (!backup || !path.isAbsolute(backup) || path.normalize(backup) !== backup) {
    throw new Error("A normalized absolute snapshot directory is required");
  }
  requireHome(targetHome);
  // A restore within the backup itself would mutate the source snapshot
  // after verification and could recursively consume its own payload.
  if (targetHome === backup || targetHome.startsWith(backup + path.sep)) {
    throw new Error("Bostan restore target must be outside the source snapshot");
  }
  const parent = path.dirname(targetHome);
  mustDir(parent);
  if (fs.existsSync(targetHome) || owned(targetHome, "dir")) {
    throw new Error("Restore requires a completely new HOME; refusing overwrite");
  }
  const proof = verifyColdSnapshot(backup); // Validate before creating target.
  let created = false;
  try {
    fs.mkdirSync(targetHome, { mode: 0o700 });
    created = true;
    const product = path.join(targetHome, ".bostan");
    const app = path.join(product, "app");
    fs.mkdirSync(product, { mode: 0o700 });
    fs.mkdirSync(app, { mode: 0o700 });
    copyEntries(path.join(backup, "payload"), app, proof.manifest.entries);
    if (!filesEqual(proof.manifest.entries, scan(app))) {
      throw new Error("Bostan restored files failed checksum verification");
    }
    verifyAppIdentity(app);
    rebaseManagedConfig(proof.manifest.sourceApp, app);
    created = false;
    return { home: targetHome, files: proof.files };
  } finally {
    if (created) fs.rmSync(targetHome, { recursive: true, force: true });
  }
}
