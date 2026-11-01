import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { stopOwnedWindowsEmbeddedPostgres } from "./windows-embedded-postgres-stop.js";
import { isEmbeddedPostgresTemplateCacheDisabled } from "./embedded-postgres-template-policy.js";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyPendingMigrations, closeRegisteredClients, ensurePostgresDatabase } from "./client.js";
import {
  createEmbeddedPostgresLogBuffer,
  formatEmbeddedPostgresError,
} from "./embedded-postgres-error.js";
import { prepareEmbeddedPostgresNativeRuntime } from "./embedded-postgres-native.js";

// Time budget (ms) for a vitest test in the embedded-Postgres cost class: a
// test that starts an embedded Postgres cluster and runs migrations. Measured
// evidence: this cost class normally finishes in well under 10s. Under a
// contended CI runner the same test took up to 4.9x longer. This budget
// gives about 10x headroom over the clean time, so a contended run still
// passes while a genuine hang still fails fast.
export const EMBEDDED_POSTGRES_TEST_TIMEOUT_MS = 90_000;

type EmbeddedPostgresInstance = {
  initialise(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
};

type EmbeddedPostgresCtor = new (opts: {
  databaseDir: string;
  user: string;
  password: string;
  port: number;
  persistent: boolean;
  initdbFlags?: string[];
  onLog?: (message: unknown) => void;
  onError?: (message: unknown) => void;
}) => EmbeddedPostgresInstance;

export type EmbeddedPostgresTestSupport = {
  supported: boolean;
  reason?: string;
};

export type EmbeddedPostgresTestDatabase = {
  connectionString: string;
  cleanup(): Promise<void>;
};

let embeddedPostgresSupportPromise: Promise<EmbeddedPostgresTestSupport> | null = null;

const DEFAULT_PAPERCLIP_EMBEDDED_POSTGRES_PORT = 54329;

function getReservedTestPorts(): Set<number> {
  const configuredPorts = [
    DEFAULT_PAPERCLIP_EMBEDDED_POSTGRES_PORT,
    Number.parseInt(process.env.PAPERCLIP_EMBEDDED_POSTGRES_PORT ?? "", 10),
    ...String(process.env.PAPERCLIP_TEST_POSTGRES_RESERVED_PORTS ?? "")
      .split(",")
      .map((value) => Number.parseInt(value.trim(), 10)),
  ];
  return new Set(configuredPorts.filter((port) => Number.isInteger(port) && port > 0 && port <= 65535));
}

type EmbeddedPostgresCtorProvider = () => Promise<EmbeddedPostgresCtor>;

async function loadEmbeddedPostgresCtor(): Promise<EmbeddedPostgresCtor> {
  const mod = await import("embedded-postgres");
  await prepareEmbeddedPostgresNativeRuntime();
  const ctor = mod.default as EmbeddedPostgresCtor;
  if (process.platform !== "win32") return ctor;
  // Resolve the native binary supplied by embedded-postgres, not system PG.
  const require = createRequire(import.meta.url);
  const embeddedRequire = createRequire(require.resolve("embedded-postgres"));
  const nativeEntry = embeddedRequire.resolve("@embedded-postgres/windows-x64");
  const native = await import(pathToFileURL(nativeEntry).href) as { postgres: string };
  const pgCtl = path.join(path.dirname(native.postgres), "pg_ctl.exe");
  if (!fs.existsSync(pgCtl)) throw Error("Pinned PostgreSQL pg_ctl missing");
  // The pinned library does not await its Windows process-tree termination.
  // Override stop ONLY in synthetic test instances to wait for graceful pg_ctl.
  return class WindowsBostanTestPg extends ctor {
    private readonly dbDir: string;
    private stopping: Promise<void> | null = null;
    constructor(options: ConstructorParameters<EmbeddedPostgresCtor>[0]) {
      super(options);
      this.dbDir = options.databaseDir;
    }
    override stop(): Promise<void> {
      if (!this.stopping) {
        this.stopping = stopOwnedWindowsEmbeddedPostgres(this.dbDir, pgCtl).then(() => {});
      }
      return this.stopping;
    }
  };
}

let embeddedPostgresCtorProvider: EmbeddedPostgresCtorProvider = loadEmbeddedPostgresCtor;

// Test seam. Replace the embedded-postgres constructor provider so a test can
// simulate a failed start without the native runtime. Pass `null` to restore
// the default provider. This module is test support only, so the seam is safe.
export function __setEmbeddedPostgresCtorProviderForTests(
  provider: EmbeddedPostgresCtorProvider | null,
): void {
  embeddedPostgresCtorProvider = provider ?? loadEmbeddedPostgresCtor;
}

async function getEmbeddedPostgresCtor(): Promise<EmbeddedPostgresCtor> {
  return await embeddedPostgresCtorProvider();
}

async function getAvailablePort(): Promise<number> {
  const reservedPorts = getReservedTestPorts();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const port = await new Promise<number>((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      server.on("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (!address || typeof address === "string") {
          server.close(() => reject(new Error("Failed to allocate test port")));
          return;
        }
        const { port } = address;
        server.close((error) => {
          if (error) reject(error);
          else resolve(port);
        });
      });
    });

    if (!reservedPorts.has(port)) return port;
  }

  throw new Error(
    `Failed to allocate embedded Postgres test port outside reserved Paperclip ports: ${[
      ...reservedPorts,
    ].join(", ")}`,
  );
}

const EMBEDDED_POSTGRES_USER = "paperclip";
const EMBEDDED_POSTGRES_PASSWORD = "paperclip";
const EMBEDDED_POSTGRES_INITDB_FLAGS = ["--encoding=UTF8", "--locale=C", "--lc-messages=C"];

async function createEmbeddedPostgresTestInstance(tempDirPrefix: string) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), tempDirPrefix));
  const owned = fs.lstatSync(dataDir);
  try {
    return await createEmbeddedPostgresTestInstanceAt(dataDir);
  } catch (error) {
    // Port allocation or native constructor loading can fail before an
    // embedded-postgres instance exists. Reclaim only this newly-created,
    // still-identical scratch directory; never touch a replaced directory.
    let current: fs.Stats;
    try { current = fs.lstatSync(dataDir); } catch {
      throw new Error("Fresh PostgreSQL scratch identity unavailable; retaining fixture", { cause: error });
    }
    if (!current.isDirectory() || current.isSymbolicLink() ||
        current.dev !== owned.dev || current.ino !== owned.ino ||
        current.birthtimeMs !== owned.birthtimeMs)
      throw new Error("Fresh PostgreSQL scratch identity changed; retaining fixture", { cause: error });
    // Directory identity alone does not grant authority over new contents:
    // a different writer may have populated this scratch after mkdtemp.
    // An atomic, nonrecursive rmdir succeeds only while truly empty.
    // Retain the entire fixture on ENOTEMPTY, replacement or any OS error.
    try {
      fs.rmdirSync(dataDir);
    } catch {
      throw new Error("Fresh PostgreSQL scratch not empty or unavailable; retaining fixture", { cause: error });
    }
    throw error;
  }
}

// Wraps an embedded-postgres instance around `dataDir`. The caller decides
// whether the directory still needs `initialise()` (a fresh cluster) or already
// holds a copied cluster that only needs `start()`.
async function createEmbeddedPostgresTestInstanceAt(dataDir: string) {
  const port = await getAvailablePort();
  const EmbeddedPostgres = await getEmbeddedPostgresCtor();
  // Postgres writes the true reason for a failed start to its output, for
  // example `could not bind IPv4 address "127.0.0.1": Address already in use`.
  // The `start()` rejection carries an empty message, so we capture the output
  // in a bounded buffer and surface it in the thrown error.
  const logBuffer = createEmbeddedPostgresLogBuffer();
  const instance = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: EMBEDDED_POSTGRES_USER,
    password: EMBEDDED_POSTGRES_PASSWORD,
    port,
    persistent: true,
    initdbFlags: EMBEDDED_POSTGRES_INITDB_FLAGS,
    onLog: (message) => logBuffer.append(message),
    onError: (message) => logBuffer.append(message),
  });

  return { dataDir, port, instance, getRecentLogs: () => logBuffer.getRecentLogs() };
}

function adminConnectionStringFor(port: number): string {
  return `postgres://${EMBEDDED_POSTGRES_USER}:${EMBEDDED_POSTGRES_PASSWORD}@127.0.0.1:${port}/postgres`;
}

function databaseConnectionStringFor(port: number): string {
  return `postgres://${EMBEDDED_POSTGRES_USER}:${EMBEDDED_POSTGRES_PASSWORD}@127.0.0.1:${port}/paperclip`;
}

function cleanupEmbeddedPostgresTestDirs(dataDir: string) {
  fs.rmSync(dataDir, { recursive: true, force: true });
}

// Upper bound (ms) on how long we await a graceful POSIX PostgreSQL stop
// before reporting an unverified shutdown and retaining the active fixture.
const EMBEDDED_POSTGRES_STOP_TIMEOUT_MS = 5000;

// `embedded-postgres@18.1.0-beta.16` exposes only `stop(): Promise<void>` — no
// shutdown-mode argument. Internally it SIGINTs the postgres process (already
// PostgreSQL "fast shutdown") and resolves *only* on the child's `exit` event,
// with no time bound of its own. Under the loaded serial server shard a slow
// shutdown checkpoint can push that past vitest's hookTimeout and hang the
// afterAll hook. If stop exceeds the bound we reject rather than falsely
// reporting quiescence; the stop Promise still owns the deferred cleanup
// callback and only runs it after native stop actually fulfills.
//
// `cleanupFn` (data-dir reclaim) is chained on the raw `stop()` promise, not on
// the timeout race, so the disposable data dir is removed *only after* `stop()`
// fulfills — i.e. once the child Postgres process has exited. Removing
// it on the timeout path would pull the data files out from under a still-running
// cluster and provoke checkpoint / WAL I/O errors. In the fast path `cleanupFn`
// has run by the time this resolves; on timeout this function rejects while
// cleanup may run later only if the original stop fulfills.
async function stopEmbeddedPostgresBounded(
  instance: EmbeddedPostgresInstance | null,
  cleanupFn?: () => void,
  timeoutMs: number = EMBEDDED_POSTGRES_STOP_TIMEOUT_MS,
): Promise<void> {
  if (!instance) {
    cleanupFn?.();
    return;
  }
  if (process.platform === "win32") {
    // Do not claim cleanup or delete data when native Windows stop failed.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        instance.stop(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(Error("Windows Bostan PostgreSQL stop timeout")), 50_000);
        }),
      ]);
      cleanupFn?.();
    } finally {
      if (timer) clearTimeout(timer);
    }
    return;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stopped = instance.stop().then(
    () => {
      try {
        cleanupFn?.();
      } catch {
        // Best-effort reclaim after a verified stop; ignore removal errors.
      }
    },
    (error: unknown) => {
      // A rejected stop is not proof that PostgreSQL and its workers exited.
      // Retain the scratch cluster and fail the test instead of deleting live WAL.
      throw new Error("Embedded PostgreSQL stop unverified; retaining fixture", { cause: error });
    },
  );
  try {
    await Promise.race([
      stopped,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("POSIX embedded PostgreSQL stop timeout; retaining fixture")),
          timeoutMs,
        );
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Upper bound on start attempts. `getAvailablePort` uses a check-then-use probe:
// it binds port 0, reads the assigned port, closes the probe, then Postgres binds
// that port. Under load another process can take the port in that window, so the
// bind fails with "Address already in use" and `start()` rejects. Each retry uses
// a fresh port and a fresh data directory, so a transient collision clears.
const EMBEDDED_POSTGRES_START_MAX_ATTEMPTS = 5;

// Start one embedded Postgres cluster with a bounded retry. Each attempt gets a
// fresh port and a fresh data directory. On a failed attempt we stop the cluster
// and remove its data directory before the next attempt. After the last attempt
// we throw with the real Postgres output so the failure is loud and diagnosable.
async function startEmbeddedPostgresWithRetry(tempDirPrefix: string): Promise<{
  port: number;
  dataDir: string;
  instance: EmbeddedPostgresInstance;
}> {
  let lastError = new Error("embedded Postgres startup failed");

  for (let attempt = 1; attempt <= EMBEDDED_POSTGRES_START_MAX_ATTEMPTS; attempt += 1) {
    const created = await createEmbeddedPostgresTestInstance(tempDirPrefix);
    try {
      await created.instance.initialise();
      await created.instance.start();
      return { port: created.port, dataDir: created.dataDir, instance: created.instance };
    } catch (error) {
      lastError = formatEmbeddedPostgresError(error, {
        fallbackMessage: "embedded Postgres startup failed",
        recentLogs: created.getRecentLogs(),
      });
      // Stop the failed cluster and remove its data directory. The next attempt
      // allocates a fresh port and a fresh data directory.
      await stopEmbeddedPostgresBounded(created.instance, () =>
        cleanupEmbeddedPostgresTestDirs(created.dataDir),
      );
    }
  }

  throw new Error(
    `Failed to start embedded PostgreSQL test database after ${EMBEDDED_POSTGRES_START_MAX_ATTEMPTS} attempts: ${lastError.message}`,
  );
}

// ---------------------------------------------------------------------------
// Template cluster cache
//
// Every suite that calls `startEmbeddedPostgresTestDatabase` used to pay for
// `initdb`, a cluster start, and all pending migrations (331 files at the time
// of writing) before its first test ran, and the `getEmbeddedPostgresTestSupport`
// probe started and stopped a second throwaway cluster per test file. On the
// serial CI shards that was 5-6s per suite plus 2.5-3s per probe; measured
// locally it is 3.2s per suite plus 0.75s per probe.
//
// A cluster data directory that was shut down cleanly can be copied and started
// again as an independent cluster. So the first caller on a host builds one
// fully migrated cluster, stops it, and publishes the data directory as a
// template under the OS temp directory. Every later caller copies the template
// (about 90 MB, ~0.2s) and starts Postgres on the copy (~0.05s), then still runs
// `ensurePostgresDatabase` and `applyPendingMigrations` so the returned database
// is exactly what the fresh path produces; both are no-ops on a template copy.
//
// The template key hashes everything that determines the cluster's contents:
// the embedded-postgres package version, the initdb flags, the user, and the
// name and content of every migration file plus the journal. A changed
// migration therefore builds a new template instead of reusing a stale one.
// Publishing is a rename, which is atomic on the same filesystem, so a
// concurrent builder either wins the rename or discards its copy and uses the
// winner's; a template that exists is always complete.
//
// A template is a Postgres data directory, and starting one executes its
// configuration (for example `shared_preload_libraries`). The cache root is
// therefore private to the current OS user: its name carries the user id, it
// is created with mode 0700, and it is only used when it is a real directory
// (not a symlink) owned by this user with no group or world write bit. Each
// template is checked the same way before it is copied. On a host with a
// shared temp directory another user can pre-create the predictable path, and
// those checks reject it. Windows has no uid; its temp directory is already
// per user, so the ownership and mode checks are skipped there.
//
// Windows bypasses the template cache until owned worker teardown is verified
// (issue #234). It never touches existing cache entries in this mode.
// Set PAPERCLIP_TEST_POSTGRES_TEMPLATE=0 to bypass the cache and run the fresh
// path for every suite. Any failure on the template path (root checks, build,
// copy, start, or publish) falls back to the fresh path, so a broken cache can
// make a suite slower but never fail it or skip it: the fresh path still
// reports a migration that cannot apply or a cluster that cannot start.
// ---------------------------------------------------------------------------

const TEMPLATE_ROOT_DIR_NAME = "paperclip-embedded-postgres-templates";
// Templates whose key no longer matches are pruned once they have not been
// used for this long. Every reuse refreshes the template's timestamp.
const TEMPLATE_PRUNE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// Publishing a template requires the builder cluster to have exited for real,
// so its data files are quiescent before the rename. Give that stop more room
// than the per-suite bounded stop; a template build happens once per host.
const TEMPLATE_BUILD_STOP_TIMEOUT_MS = 30_000;

export type EmbeddedPostgresStartMode = "template" | "fresh";

function isTemplateCacheDisabled(): boolean {
  // #234: Windows shutdown has not proved that all owned io_worker children exit.
  // Do not publish, reuse or prune cached clusters until that proof exists.
  // Existing cache directories are preserved without modification.
  return isEmbeddedPostgresTemplateCacheDisabled(
    process.platform,
    process.env.PAPERCLIP_TEST_POSTGRES_TEMPLATE,
  );
}

function migrationsDirectory(): string {
  return fileURLToPath(new URL("./migrations/", import.meta.url));
}

function embeddedPostgresPackageVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const manifest = require("embedded-postgres/package.json") as { version?: unknown };
    return typeof manifest.version === "string" ? manifest.version : "unknown";
  } catch {
    return "unknown";
  }
}

// Hash of everything that determines the contents of a migrated cluster. Reads
// every migration file, which costs a few milliseconds per process.
export function computeEmbeddedPostgresTemplateKey(
  migrationsDir: string = migrationsDirectory(),
  input: { packageVersion?: string; initdbFlags?: string[]; user?: string } = {},
): string {
  const hash = createHash("sha256");
  hash.update(`embedded-postgres=${input.packageVersion ?? embeddedPostgresPackageVersion()}\n`);
  hash.update(`initdb=${(input.initdbFlags ?? EMBEDDED_POSTGRES_INITDB_FLAGS).join(" ")}\n`);
  hash.update(`user=${input.user ?? EMBEDDED_POSTGRES_USER}\n`);
  const journalPath = path.join(migrationsDir, "meta", "_journal.json");
  if (fs.existsSync(journalPath)) {
    hash.update(`journal\n`);
    hash.update(fs.readFileSync(journalPath));
    hash.update(`\n`);
  }
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
  for (const name of migrationFiles) {
    hash.update(`${name}\n`);
    hash.update(fs.readFileSync(path.join(migrationsDir, name)));
    hash.update(`\n`);
  }
  return hash.digest("hex").slice(0, 24);
}

// The uid on POSIX, else the user name. Part of the cache root's name so two
// users on one host never share a root.
function templateOwnerTag(): string {
  const uid = process.getuid?.();
  if (uid !== undefined) return String(uid);
  let username = "user";
  try {
    username = os.userInfo().username;
  } catch {
    // Fall through to the generic tag.
  }
  return username.replace(/[^A-Za-z0-9_.-]/g, "_");
}

function templateRootDir(): string {
  return path.join(os.tmpdir(), `${TEMPLATE_ROOT_DIR_NAME}-${templateOwnerTag()}`);
}

// Why `dir` cannot be trusted as a private directory of the current user, or
// null when it can. Uses `lstat` so a symlink planted at the path is rejected
// rather than followed. On Windows (no uid) only the directory check applies.
function describePrivateDirectoryProblem(dir: string): string | null {
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(dir);
  } catch (error) {
    return `cannot be inspected (${(error as NodeJS.ErrnoException).code ?? "unknown error"})`;
  }
  if (stat.isSymbolicLink()) return "is a symbolic link";
  if (!stat.isDirectory()) return "is not a directory";
  const uid = process.getuid?.();
  if (uid === undefined) return null;
  if (stat.uid !== uid) return `is owned by uid ${stat.uid}, not the current user (uid ${uid})`;
  if ((stat.mode & 0o022) !== 0) {
    return `is writable by group or others (mode ${(stat.mode & 0o777).toString(8)})`;
  }
  return null;
}

// Creates the cache root with mode 0700 and verifies it is private to the
// current user. Returns null, after one warning, when it is not: the cache is
// then unused for this process and every suite takes the fresh path.
function prepareTemplateRootDir(): string | null {
  const rootDir = templateRootDir();
  try {
    fs.mkdirSync(rootDir, { recursive: true, mode: 0o700 });
    const problem = describePrivateDirectoryProblem(rootDir);
    if (problem !== null) {
      warnTemplateOnce("root", `template cache root ${rootDir} ${problem}; using fresh clusters`);
      return null;
    }
    // A root created by an earlier version may be wider than 0700. It is
    // ours (checked above), so narrow it.
    if (process.getuid !== undefined && (fs.lstatSync(rootDir).mode & 0o777) !== 0o700) {
      fs.chmodSync(rootDir, 0o700);
    }
    return rootDir;
  } catch (error) {
    warnTemplateOnce(
      "root",
      `template cache root ${rootDir} could not be prepared: ${(error as Error).message}; using fresh clusters`,
    );
    return null;
  }
}

// A template is usable when it is a private directory of the current user
// that holds a cleanly stopped cluster: `PG_VERSION` present, no
// `postmaster.pid`. The ownership check repeats the root's check so a
// template is never copied from a directory this user does not own.
function isUsableTemplate(dir: string): boolean {
  if (describePrivateDirectoryProblem(dir) !== null) return false;
  return fs.existsSync(path.join(dir, "PG_VERSION")) && !fs.existsSync(path.join(dir, "postmaster.pid"));
}

// Records a use of the template so `pruneStaleTemplates` measures idle time,
// not age. Best effort.
function touchTemplate(dir: string): void {
  try {
    const now = new Date();
    fs.utimesSync(dir, now, now);
  } catch {
    // The template still works without the refreshed timestamp.
  }
}

const warnedTemplateTopics = new Set<string>();

function warnTemplateOnce(topic: string, message: string): void {
  if (warnedTemplateTopics.has(topic)) return;
  warnedTemplateTopics.add(topic);
  console.warn(`[embedded-postgres] ${message}`);
}

// A private cache root is not evidence that every child belongs to Bostan.
// Older versions could recursively delete arbitrary stale directories under
// that root. Only templates stamped by a successful Bostan build may be
// reclaimed; unmarked, malformed, live, linked, or foreign entries are retained.
const TEMPLATE_OWNER_MARKER = ".bostan-template-owner";
const templateOwnerMarkerContents = (key: string) => `bostan-test-template-v1:${key}\n`;

function isPrunableOwnedTemplate(dir: string, key: string): boolean {
  if (!/^[a-f0-9]{24}$/.test(key) || !isUsableTemplate(dir)) return false;
  try {
    const marker = path.join(dir, TEMPLATE_OWNER_MARKER);
    const info = fs.lstatSync(marker);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 ||
        info.size > 80 || (info.mode & 0o022) !== 0) return false;
    return fs.readFileSync(marker, "utf8") === templateOwnerMarkerContents(key);
  } catch {
    return false;
  }
}

// Best-effort pruning of explicitly owned, stopped Bostan template clusters.
// Never reclaim pre-marker templates, unknown directories or live clusters.
// A separate process may race this sweep; retain on any failed revalidation.
function pruneStaleTemplates(rootDir: string, keepDir: string): void {
  if (describePrivateDirectoryProblem(rootDir) !== null) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return;
  }
  const now = Date.now();
  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entryPath === keepDir || !entry.isDirectory()) continue;
    try {
      const info = fs.lstatSync(entryPath);
      if (!info.isDirectory() || info.isSymbolicLink() ||
          now - info.mtimeMs <= TEMPLATE_PRUNE_AGE_MS ||
          !isPrunableOwnedTemplate(entryPath, entry.name)) continue;
      const current = fs.lstatSync(entryPath);
      if (current.dev !== info.dev || current.ino !== info.ino ||
          current.birthtimeMs !== info.birthtimeMs ||
          !isPrunableOwnedTemplate(entryPath, entry.name)) continue;
      fs.rmSync(entryPath, { recursive: true, force: true });
    } catch {
      // Ownership or identity became uncertain; retain the entry.
    }
  }
}

// Waits for the raw `stop()` so the builder cluster has really exited before
// its data directory is published. Returns false if the stop overran.
async function stopForTemplatePublish(instance: EmbeddedPostgresInstance): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      instance.stop().then(() => true, () => false),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), TEMPLATE_BUILD_STOP_TIMEOUT_MS);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Builds a migrated cluster and publishes its data directory at `templateDir`.
// Throws when the cluster cannot start or a migration cannot apply. Returns
// false when the cluster started but the template could not be published;
// callers then use the fresh path for this process.
async function buildEmbeddedPostgresTemplate(templateDir: string): Promise<boolean> {
  const rootDir = path.dirname(templateDir);
  const { port, dataDir, instance } = await startEmbeddedPostgresWithRetry(
    "paperclip-embedded-postgres-template-build-",
  );
  let published = false;
  try {
    await ensurePostgresDatabase(adminConnectionStringFor(port), "paperclip");
    await applyPendingMigrations(databaseConnectionStringFor(port));
    const stopped = await stopForTemplatePublish(instance);
    if (!stopped || !isUsableTemplate(dataDir)) return false;
    // Stamp only a newly built, verified-stopped native cluster. Preexisting
    // or foreign cache entries never gain deletion authority retroactively.
    const templateKey = path.basename(templateDir);
    if (!/^[a-f0-9]{24}$/.test(templateKey)) return false;
    fs.writeFileSync(
      path.join(dataDir, TEMPLATE_OWNER_MARKER),
      templateOwnerMarkerContents(templateKey),
      { flag: "wx", mode: 0o600 },
    );
    try {
      fs.renameSync(dataDir, templateDir);
      published = true;
    } catch (error) {
      // Another process published the same key first. Use theirs.
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EEXIST" || code === "ENOTEMPTY" || code === "EPERM") {
        return isUsableTemplate(templateDir);
      }
      throw error;
    }
    pruneStaleTemplates(rootDir, templateDir);
    return true;
  } finally {
    if (!published) {
      await stopEmbeddedPostgresBounded(instance, () => cleanupEmbeddedPostgresTestDirs(dataDir));
    }
  }
}

// Test-only seam for synthetic, exclusively owned scratch fixtures.
export const __pruneStaleTemplatesForTests = pruneStaleTemplates;

let templateDirPromise: Promise<string | null> | null = null;

// Resolves the template data directory for this host, building it on first
// use. Resolves null when the cache is disabled, the cache root is not private
// to this user, or the template could not be built or published; every caller
// then takes the fresh path, which reports the real error itself (a cluster
// that cannot start, a migration that cannot apply). Never rejects, so a
// broken cache can never turn into `supported: false` and skip a suite.
async function getEmbeddedPostgresTemplateDir(): Promise<string | null> {
  if (isTemplateCacheDisabled()) return null;
  if (!templateDirPromise) {
    templateDirPromise = (async () => {
      const rootDir = prepareTemplateRootDir();
      if (rootDir === null) return null;
      const templateDir = path.join(rootDir, computeEmbeddedPostgresTemplateKey());
      if (isUsableTemplate(templateDir)) {
        touchTemplate(templateDir);
        return templateDir;
      }
      try {
        const built = await buildEmbeddedPostgresTemplate(templateDir);
        return built && isUsableTemplate(templateDir) ? templateDir : null;
      } catch (error) {
        warnTemplateOnce(
          "build",
          `template build failed, using fresh clusters: ${(error as Error).message}`,
        );
        return null;
      }
    })();
  }
  return await templateDirPromise;
}

// Forgets the resolved template so the next caller in this process checks the
// cache again. Used after a template start failed, for example because the
// template was pruned by another process after this one resolved its path.
function resetTemplateDirCache(): void {
  templateDirPromise = null;
}

// Copies the template and starts a cluster on the copy. Each attempt uses a
// fresh copy and a fresh port, mirroring `startEmbeddedPostgresWithRetry`. A
// template that is no longer usable (pruned, or no longer private) is not
// retried: the caller falls back and the next caller rebuilds it.
async function startEmbeddedPostgresFromTemplateWithRetry(
  templateDir: string,
  tempDirPrefix: string,
): Promise<{ port: number; dataDir: string; instance: EmbeddedPostgresInstance }> {
  let lastError = new Error("embedded Postgres startup from template failed");

  for (let attempt = 1; attempt <= EMBEDDED_POSTGRES_START_MAX_ATTEMPTS; attempt += 1) {
    if (!isUsableTemplate(templateDir)) {
      throw new Error(`embedded Postgres template ${templateDir} is no longer usable`);
    }
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), tempDirPrefix));
    const dataDir = path.join(rootDir, "data");
    let created: Awaited<ReturnType<typeof createEmbeddedPostgresTestInstanceAt>> | null = null;
    try {
      fs.cpSync(templateDir, dataDir, { recursive: true });
      // Postgres refuses a data directory that is group or world accessible.
      fs.chmodSync(dataDir, 0o700);
      created = await createEmbeddedPostgresTestInstanceAt(dataDir);
      await created.instance.start();
      return { port: created.port, dataDir: rootDir, instance: created.instance };
    } catch (error) {
      lastError = formatEmbeddedPostgresError(error, {
        fallbackMessage: "embedded Postgres startup from template failed",
        recentLogs: created?.getRecentLogs(),
      });
      await stopEmbeddedPostgresBounded(created?.instance ?? null, () =>
        cleanupEmbeddedPostgresTestDirs(rootDir),
      );
    }
  }

  throw new Error(
    `Failed to start embedded PostgreSQL from template after ${EMBEDDED_POSTGRES_START_MAX_ATTEMPTS} attempts: ${lastError.message}`,
  );
}

let templateFallbackWarned = false;
let lastStartMode: EmbeddedPostgresStartMode | null = null;

// Test-only accessors. Production callers use `startEmbeddedPostgresTestDatabase`
// or `getEmbeddedPostgresTestSupport`. A test drives the bounded retry directly
// so it does not need a real Postgres connection.
export const __startEmbeddedPostgresWithRetryForTests = startEmbeddedPostgresWithRetry;
export const __stopEmbeddedPostgresBoundedForTests = stopEmbeddedPostgresBounded;
export const __embeddedPostgresStartMaxAttemptsForTests = EMBEDDED_POSTGRES_START_MAX_ATTEMPTS;
export const __embeddedPostgresTemplateRootDirForTests = templateRootDir;
export const __isUsableEmbeddedPostgresTemplateForTests = isUsableTemplate;
export function __lastEmbeddedPostgresStartModeForTests(): EmbeddedPostgresStartMode | null {
  return lastStartMode;
}
// Forgets the support probe result, the resolved template, and the one-time
// warnings so a test can drive the probe and the cache again in one process.
export function __resetEmbeddedPostgresTemplateStateForTests(): void {
  embeddedPostgresSupportPromise = null;
  templateDirPromise = null;
  templateFallbackWarned = false;
  warnedTemplateTopics.clear();
  lastStartMode = null;
}

async function probeEmbeddedPostgresSupport(): Promise<EmbeddedPostgresTestSupport> {
  // A published template proves this host can run the cluster: it was built
  // here. Reusing it makes the probe free for every file after the first.
  // Building it costs one cluster start, the same as the throwaway probe did.
  // When the template cannot be built or used, the throwaway probe below
  // decides, so only a cluster that cannot start reports `supported: false`;
  // a migration that cannot apply fails the suite loudly on the fresh path.
  if ((await getEmbeddedPostgresTemplateDir()) !== null) return { supported: true };

  let started: { dataDir: string; instance: EmbeddedPostgresInstance } | null = null;

  try {
    started = await startEmbeddedPostgresWithRetry("paperclip-embedded-postgres-probe-");
    return { supported: true };
  } catch (error) {
    return {
      supported: false,
      reason: formatEmbeddedPostgresError(error, {
        fallbackMessage: "embedded Postgres startup failed",
      }).message,
    };
  } finally {
    if (started) {
      const { dataDir, instance } = started;
      await stopEmbeddedPostgresBounded(instance, () => cleanupEmbeddedPostgresTestDirs(dataDir));
    }
  }
}

export async function getEmbeddedPostgresTestSupport(): Promise<EmbeddedPostgresTestSupport> {
  if (!embeddedPostgresSupportPromise) {
    embeddedPostgresSupportPromise = probeEmbeddedPostgresSupport();
  }
  return await embeddedPostgresSupportPromise;
}

// Starts the cluster for one suite: from the host template when one is
// available, otherwise a fresh `initdb`. Template failures fall back to the
// fresh path so the cache can only make a suite faster, never fail it.
async function startEmbeddedPostgresClusterForSuite(
  tempDirPrefix: string,
): Promise<{ port: number; dataDir: string; instance: EmbeddedPostgresInstance; mode: EmbeddedPostgresStartMode }> {
  const templateDir = await getEmbeddedPostgresTemplateDir();

  if (templateDir !== null) {
    try {
      const started = await startEmbeddedPostgresFromTemplateWithRetry(templateDir, tempDirPrefix);
      return { ...started, mode: "template" };
    } catch (error) {
      // The next caller in this process re-resolves the template: if it was
      // pruned it is rebuilt, instead of retrying a path that is gone.
      resetTemplateDirCache();
      if (!templateFallbackWarned) {
        templateFallbackWarned = true;
        console.warn(
          `[embedded-postgres] template start failed, using a fresh cluster: ${(error as Error).message}`,
        );
      }
    }
  }

  // The bounded retry hardens the cluster start against the port race. It throws
  // with the real Postgres output if every attempt fails.
  const started = await startEmbeddedPostgresWithRetry(tempDirPrefix);
  return { ...started, mode: "fresh" };
}

export async function startEmbeddedPostgresTestDatabase(
  tempDirPrefix: string,
): Promise<EmbeddedPostgresTestDatabase> {
  const { port, dataDir, instance, mode } = await startEmbeddedPostgresClusterForSuite(tempDirPrefix);
  lastStartMode = mode;

  try {
    // Both calls are no-ops on a template copy and keep the returned database
    // identical to the fresh path even if the template were ever stale.
    await ensurePostgresDatabase(adminConnectionStringFor(port), "paperclip");
    const connectionString = databaseConnectionStringFor(port);
    await applyPendingMigrations(connectionString);

    return {
      connectionString,
      cleanup: async () => {
        // End every client a caller created against this cluster first. A
        // client that still holds a reserved connection when the cluster
        // stops can crash the process: the stop kills the backend socket,
        // but a queued write on that connection still fires later and finds
        // a null socket.
        await closeRegisteredClients(connectionString);
        await stopEmbeddedPostgresBounded(instance, () => cleanupEmbeddedPostgresTestDirs(dataDir));
      },
    };
  } catch (error) {
    await stopEmbeddedPostgresBounded(instance, () => cleanupEmbeddedPostgresTestDirs(dataDir));
    throw new Error(
      `Failed to start embedded PostgreSQL test database: ${
        formatEmbeddedPostgresError(error, {
          fallbackMessage: "embedded Postgres startup failed",
        }).message
      }`,
    );
  }
}
