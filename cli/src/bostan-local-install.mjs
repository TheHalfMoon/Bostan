import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_DIR = fileURLToPath(new URL("../", import.meta.url));
const PACKAGE_FILE = path.join(PACKAGE_DIR, "package.json");
const INSTALL_MARKER = "bostan-native-local-preview-v1";
const SAFE_DIR_MODE = 0o700;
const FILE_MODE = 0o600;
const SHIM_MODE = 0o700;

function packageVersion() {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_FILE, "utf8"));
  if (pkg.name !== "bostan" || !/^[0-9A-Za-z][0-9A-Za-z.+-]*$/.test(pkg.version)) {
    throw new Error("Bostan package identity is invalid");
  }
  return pkg.version;
}

function inspect(target, type) {
  let stat;
  try { stat = fs.lstatSync(target); }
  catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
  if (stat.isSymbolicLink() || (type === "directory" && !stat.isDirectory())
    || (type === "file" && (!stat.isFile() || stat.nlink !== 1))) {
    throw new Error("Unsafe or unexpected filesystem entry: " + target);
  }
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) {
    throw new Error("Entry is not owned by the current user: " + target);
  }
  return true;
}

function safeDirectory(target, create) {
  if (inspect(target, "directory")) return true;
  if (!create) return false;
  fs.mkdirSync(target, { mode: SAFE_DIR_MODE });
  if (!inspect(target, "directory")) throw new Error("Failed to create Bostan directory");
  return true;
}

export function localPaths(home = process.env.HOME || os.homedir()) {
  if (!path.isAbsolute(home)) throw new Error("HOME must be absolute");
  const root = path.resolve(home);
  if (root !== path.normalize(home)) throw new Error("HOME must be normalized");
  return {
    home: root,
    product: path.join(root, ".bostan"),
    cli: path.join(root, ".bostan", "cli"),
    versions: path.join(root, ".bostan", "cli", "versions"),
    manifest: path.join(root, ".bostan", "cli", "install.json"),
    lock: path.join(root, ".bostan", "cli", ".install.lock"),
    local: path.join(root, ".local"),
    bin: path.join(root, ".local", "bin"),
    shim: path.join(root, ".local", "bin", process.platform === "win32" ? "bostan.cmd" : "bostan"),
  };
}

function existingPathSafety(paths) {
  inspect(paths.home, "directory");
  for (const directory of [paths.product, paths.cli, paths.versions, paths.local, paths.bin]) {
    inspect(directory, "directory");
  }
  for (const file of [paths.manifest, paths.lock, paths.shim]) inspect(file, "file");
}

function shimText(entry) {
  if (process.platform === "win32") {
    const node = process.execPath;
    // The shell wrapper is only permitted in disposable NTFS QA homes.
    // Refuse CMD variable expansion, escape and newline characters in paths.
    for (const value of [node, entry]) {
      if (!/^[A-Za-z]:\\/.test(value) || /[%!"^<>|\r\n]/.test(value)) {
        throw new Error("Unsafe Windows CLI QA command path");
      }
    }
    return '@echo off\r\nsetlocal DisableDelayedExpansion\r\n"' +
      node + '" "' + entry + '" %*\r\nexit /b %errorlevel%\r\n';
  }
  // Quoting is POSIX shell safe for arbitrary absolute home-directory paths.
  const escaped = entry.replaceAll("'", "'\\''");
  return "#!/bin/sh\nexec node '" + escaped + "' \"$@\"\n";
}

function requireWindowsTempQa(home) {
  if (process.env.BOSTAN_WINDOWS_TEMP_QA !== "1") {
    throw new Error("Windows local CLI installation requires explicit disposable TEMP QA");
  }
  const temp = fs.realpathSync(os.tmpdir()).toLowerCase();
  const actual = fs.realpathSync(home).toLowerCase();
  if (!actual.startsWith(temp + path.sep) ||
      !/(?:^|[\\/])bostan-native-install-test-[^\\/]+[\\/]home[^\\/]*$/.test(actual) ||
      fs.lstatSync(home).isSymbolicLink()) {
    throw new Error("Windows local CLI QA refuses any non-disposable HOME");
  }
  return true;
}

function protectWindowsTempQa(home) {
  const checker = fileURLToPath(new URL("../../scripts/bostan-windows-acl.mjs", import.meta.url));
  if (!fs.existsSync(checker)) {
    throw new Error("Windows local CLI QA requires the original source checkout");
  }
  for (const mode of ["apply-product", "apply-local"]) {
    try {
      execFileSync(process.execPath, [checker, mode, home], {
        env: { ...process.env, BOSTAN_WINDOWS_TEMP_QA: "1" },
        windowsHide: true, encoding: "utf8", timeout: 30000,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      throw new Error("Windows local CLI QA private NTFS ACL admission failed");
    }
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sourcePayload() {
  const sourcePreview = new URL("./bostan-preview.mjs", import.meta.url);
  const preview = fs.existsSync(sourcePreview) ? sourcePreview : new URL("./bostan.js", import.meta.url);
  const files = new Map([
    ["dist/bostan.js", fs.readFileSync(preview)],
    ["dist/bostan-local-install.mjs", fs.readFileSync(new URL("./bostan-local-install.mjs", import.meta.url))],
    ["dist/bostan-company-export-inspect.mjs", fs.readFileSync(new URL("./bostan-company-export-inspect.mjs", import.meta.url))],
    ["package.json", Buffer.from(JSON.stringify({
      name: "bostan",
      version: packageVersion(),
      type: "module",
      private: true,
      bin: { bostan: "dist/bostan.js" },
    }, null, 2) + "\n")],
  ]);
  return { files, digest: sha256(Buffer.concat([...files.values()])) };
}

function managedManifest(paths) {
  if (!inspect(paths.manifest, "file")) return null;
  const value = JSON.parse(fs.readFileSync(paths.manifest, "utf8"));
  if (value?.schema !== 1 || value?.marker !== INSTALL_MARKER
    || typeof value.version !== "string" || !/^[0-9A-Za-z.+-]+$/.test(value.version)
    || !/^[a-f0-9]{64}$/.test(value.digest)) {
    throw new Error("Unrecognized Bostan install manifest");
  }
  const expectedDir = path.join(paths.versions, value.version + "-" + value.digest.slice(0, 12));
  if (value.directory !== expectedDir || value.entry !== path.join(expectedDir, "dist", "bostan.js")) {
    throw new Error("Bostan install manifest contains an unexpected path");
  }
  if (!inspect(value.directory, "directory") || !inspect(path.join(value.directory, "dist"), "directory")) {
    throw new Error("Bostan installed payload is missing");
  }
  const contents = [];
  for (const file of ["dist/bostan.js", "dist/bostan-local-install.mjs",
    "dist/bostan-company-export-inspect.mjs", "package.json"]) {
    const item = path.join(value.directory, file);
    if (!inspect(item, "file")) throw new Error("Bostan installed file missing");
    contents.push(fs.readFileSync(item));
  }
  if (sha256(Buffer.concat(contents)) !== value.digest) throw new Error("Bostan installed files were modified");
  const binContent = shimText(value.entry);
  if (!inspect(paths.shim, "file") || fs.readFileSync(paths.shim, "utf8") !== binContent) {
    throw new Error("Bostan managed shim is missing or changed");
  }
  return value;
}

export function statusLocal(home) {
  const paths = localPaths(home);
  existingPathSafety(paths);
  const manifest = managedManifest(paths);
  if (!manifest) {
    if (inspect(paths.shim, "file") || inspect(paths.lock, "file")) {
      throw new Error("Unmanaged or incomplete Bostan installation detected; no changes made");
    }
    return { installed: false, dataRoot: paths.product };
  }
  return { installed: true, version: manifest.version, dataRoot: paths.product, command: paths.shim };
}

function exclusiveFile(filename, content, mode) {
  const fd = fs.openSync(filename, "wx", mode);
  try { fs.writeFileSync(fd, content); }
  finally { fs.closeSync(fd); }
}

export function installLocal(home) {
  if (!["darwin", "linux", "win32"].includes(process.platform)) {
    throw new Error("Native local installation is not yet qualified on this operating system");
  }
  const paths = localPaths(home);
  if (process.platform === "win32") requireWindowsTempQa(paths.home);
  existingPathSafety(paths);
  if (inspect(paths.manifest, "file") || inspect(paths.shim, "file")) {
    throw new Error("A Bostan installation or command already exists; refusing to overwrite");
  }
  if (inspect(paths.lock, "file")) throw new Error("Another Bostan installation may be active");
  if (!inspect(paths.home, "directory")) throw new Error("HOME directory is missing");

  const version = packageVersion();
  const payload = sourcePayload();
  const directory = path.join(paths.versions, version + "-" + payload.digest.slice(0, 12));
  if (inspect(directory, "directory")) throw new Error("Existing payload directory not adopted");
  for (const dir of [paths.product, paths.cli, paths.versions, paths.local, paths.bin]) {
    const parent = path.dirname(dir);
    if (!inspect(parent, "directory")) throw new Error("Unsafe parent directory " + parent);
    safeDirectory(dir, true);
  }
  if (process.platform === "win32") protectWindowsTempQa(paths.home);
  exclusiveFile(paths.lock, String(process.pid) + "\n", FILE_MODE);
  let installedShim = false;
  let createdPayload = false;
  let wroteManifest = false;
  try {
    fs.mkdirSync(directory, { mode: SAFE_DIR_MODE });
    createdPayload = true;
    safeDirectory(path.join(directory, "dist"), true);
    for (const [filename, contents] of payload.files) {
      const dest = path.join(directory, filename);
      exclusiveFile(dest, contents, filename === "dist/bostan.js" ? SHIM_MODE : FILE_MODE);
    }
    const entry = path.join(directory, "dist", "bostan.js");
    exclusiveFile(paths.shim, shimText(entry), SHIM_MODE);
    installedShim = true;
    const manifest = {
      schema: 1, marker: INSTALL_MARKER, version, digest: payload.digest,
      directory, entry,
    };
    wroteManifest = true;
    exclusiveFile(paths.manifest, JSON.stringify(manifest, null, 2) + "\n", FILE_MODE);
    return statusLocal(paths.home);
  } catch (error) {
    // Roll back only entries created by this invocation, not preexisting data.
    if (wroteManifest) fs.rmSync(paths.manifest, { force: true });
    if (installedShim) fs.rmSync(paths.shim, { force: true });
    if (createdPayload) fs.rmSync(directory, { recursive: true, force: true });
    throw error;
  } finally {
    fs.rmSync(paths.lock, { force: true });
  }
}
