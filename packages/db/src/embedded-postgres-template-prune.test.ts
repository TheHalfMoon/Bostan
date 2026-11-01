import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  __embeddedPostgresTemplateRootDirForTests as templateRootDir,
  __pruneStaleTemplatesForTests as pruneStaleTemplates,
  __resetEmbeddedPostgresTemplateStateForTests as resetTemplateState,
  __setEmbeddedPostgresCtorProviderForTests as setCtorProvider,
  computeEmbeddedPostgresTemplateKey,
  getEmbeddedPostgresTestSupport,
} from "./test-embedded-postgres.js";

const AGE_MS = 10 * 24 * 60 * 60 * 1000;
const OWNER_MARKER = ".bostan-template-owner";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-prune-owned-only-"));
  fs.chmodSync(root, 0o700);
  const keepDir = path.join(root, "f".repeat(24));
  fs.mkdirSync(keepDir, { mode: 0o700 });
  return { root, keepDir, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

function agedTemplate(root: string, key: string, marker?: string) {
  const dir = path.join(root, key);
  fs.mkdirSync(dir, { mode: 0o700 });
  fs.writeFileSync(path.join(dir, "PG_VERSION"), "18\n");
  fs.writeFileSync(path.join(dir, "synthetic-owned-test-sentinel"), "keep\n");
  if (marker !== undefined) {
    fs.writeFileSync(path.join(dir, OWNER_MARKER), marker, { flag: "wx", mode: 0o600 });
  }
  const old = new Date(Date.now() - AGE_MS);
  fs.utimesSync(dir, old, old);
  return dir;
}

describe("Bostan template prune ownership admission", () => {
  it("retains an old unmarked or mismarked directory, including its contents", () => {
    const { root, keepDir, cleanup } = fixture();
    try {
      const unmarked = agedTemplate(root, "a".repeat(24));
      const mismarked = agedTemplate(root, "b".repeat(24), "foreign owner\n");
      const arbitrary = agedTemplate(root, "unrelated-fixture");
      pruneStaleTemplates(root, keepDir);
      for (const dir of [unmarked, mismarked, arbitrary]) {
        expect(fs.readFileSync(path.join(dir, "synthetic-owned-test-sentinel"), "utf8")).toBe("keep\n");
      }
    } finally {
      cleanup();
    }
  });

  it("prunes only an aged, stopped, private Bostan-marked synthetic template", () => {
    const { root, keepDir, cleanup } = fixture();
    try {
      const key = "c".repeat(24);
      const marked = agedTemplate(root, key, `bostan-test-template-v1:${key}\n`);
      const liveKey = "d".repeat(24);
      const live = agedTemplate(root, liveKey, `bostan-test-template-v1:${liveKey}\n`);
      fs.writeFileSync(path.join(live, "postmaster.pid"), "synthetic-live-marker\n");
      pruneStaleTemplates(root, keepDir);
      expect(fs.existsSync(marked)).toBe(false);
      expect(fs.existsSync(live)).toBe(true);
      expect(fs.existsSync(keepDir)).toBe(true);
    } finally {
      cleanup();
    }
  });
});

describe("Bostan template reuse ownership admission", () => {
  it("refuses a preexisting unmarked template before declaring PostgreSQL supported", async () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-template-reuse-owned-"));
    const keys = ["TMPDIR", "TEMP", "TMP", "PAPERCLIP_TEST_POSTGRES_TEMPLATE"] as const;
    const previous = new Map(keys.map((key) => [key, process.env[key]] as const));
    try {
      for (const key of ["TMPDIR", "TEMP", "TMP"]) process.env[key] = scratch;
      delete process.env.PAPERCLIP_TEST_POSTGRES_TEMPLATE;
      const key = computeEmbeddedPostgresTemplateKey();
      const root = templateRootDir();
      fs.mkdirSync(root, { mode: 0o700 });
      const template = agedTemplate(root, key);
      // The fake provider must never start a native cluster or touch foreign data.
      setCtorProvider(async () => { throw new Error("synthetic native unavailable"); });
      resetTemplateState();
      expect((await getEmbeddedPostgresTestSupport()).supported).toBe(false);
      expect(fs.readFileSync(path.join(template, "synthetic-owned-test-sentinel"), "utf8")).toBe("keep\n");

      // The exact stopped-template ownership marker permits reuse without a
      // native constructor. This remains a synthetic admission test, not PG QA.
      fs.writeFileSync(
        path.join(template, OWNER_MARKER),
        `bostan-test-template-v1:${key}\n`,
        { flag: "wx", mode: 0o600 },
      );
      resetTemplateState();
      expect(await getEmbeddedPostgresTestSupport()).toEqual({ supported: true });
    } finally {
      setCtorProvider(null);
      resetTemplateState();
      for (const key of keys) {
        const value = previous.get(key);
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  });
});
