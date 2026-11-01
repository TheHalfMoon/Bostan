import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import {
  __setEmbeddedPostgresCtorProviderForTests,
  __startEmbeddedPostgresWithRetryForTests,
} from "./test-embedded-postgres.js";

afterEach(() => __setEmbeddedPostgresCtorProviderForTests(null));

it("reclaims its own empty PostgreSQL scratch when constructor loading fails before initialise", async () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-pg-prestart-owned-"));
  const marker = path.join(scratch, "BOSTAN_QA_OWNED");
  const markerBytes = "BOSTAN_TEST_ONLY\n";
  fs.writeFileSync(marker, markerBytes);
  const original = new Map(["TMPDIR", "TEMP", "TMP"].map((key) =>
    [key, process.env[key]] as const));
  const prefix = "bostan-ctor-failure-" + randomUUID() + "-";
  try {
    for (const key of original.keys()) process.env[key] = scratch;
    expect(os.tmpdir()).toBe(scratch);
    __setEmbeddedPostgresCtorProviderForTests(async () => {
      throw new Error("synthetic constructor unavailable before initdb");
    });
    await expect(__startEmbeddedPostgresWithRetryForTests(prefix))
      .rejects.toThrow("synthetic constructor unavailable before initdb");
    // No native PostgreSQL instance was ever created, and no test-owned
    // directory may survive the failed constructor import.
    expect(fs.readdirSync(scratch)).toEqual(["BOSTAN_QA_OWNED"]);
  } finally {
    __setEmbeddedPostgresCtorProviderForTests(null);
    for (const [key, value] of original) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    // Clean only this invocation's uniquely named, ordinary directories.
    // Unexpected entries are never removed, even if the test fails.
    const entries = fs.readdirSync(scratch);
    if (fs.lstatSync(marker).isFile() &&
        !fs.lstatSync(marker).isSymbolicLink() &&
        fs.readFileSync(marker, "utf8") === markerBytes &&
        entries.every((entry) => entry === "BOSTAN_QA_OWNED" ||
          entry.startsWith(prefix))) {
      for (const entry of entries.filter((name) => name.startsWith(prefix))) {
        const owned = path.join(scratch, entry);
        const stat = fs.lstatSync(owned);
        if (!stat.isDirectory() || stat.isSymbolicLink())
          throw new Error("Unexpected test scratch entry; retaining it");
        fs.rmSync(owned, { recursive: true, force: true });
      }
      fs.unlinkSync(marker);
      fs.rmdirSync(scratch);
    }
  }
});

it("retains a newly populated scratch directory instead of erasing unexpected content", async () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-pg-nonempty-owned-"));
  const marker = path.join(scratch, "BOSTAN_QA_OWNED");
  const markerBytes = "BOSTAN_TEST_ONLY\n";
  fs.writeFileSync(marker, markerBytes);
  const original = new Map(["TMPDIR", "TEMP", "TMP"].map((key) =>
    [key, process.env[key]] as const));
  const prefix = "bostan-prestart-nonempty-" + randomUUID() + "-";
  const sentinel = "test-created-unexpected-content";
  const sentinelBytes = "must not be erased";
  let owned: string | undefined;
  try {
    for (const key of original.keys()) process.env[key] = scratch;
    expect(os.tmpdir()).toBe(scratch);
    __setEmbeddedPostgresCtorProviderForTests(async () => {
      const dirs = fs.readdirSync(scratch).filter(name => name.startsWith(prefix));
      expect(dirs).toHaveLength(1);
      owned = path.join(scratch, dirs[0]);
      const info = fs.lstatSync(owned);
      expect(info.isDirectory() && !info.isSymbolicLink()).toBe(true);
      // This file is deliberately created after the fixture mkdtemp.
      fs.writeFileSync(path.join(owned, sentinel), sentinelBytes, { flag: "wx" });
      throw new Error("synthetic constructor rejection after unexpected write");
    });
    await expect(__startEmbeddedPostgresWithRetryForTests(prefix))
      .rejects.toThrow("Fresh PostgreSQL scratch not empty or unavailable; retaining fixture");
    expect(owned).toBeDefined();
    expect(fs.readFileSync(path.join(owned!, sentinel), "utf8")).toBe(sentinelBytes);
  } finally {
    __setEmbeddedPostgresCtorProviderForTests(null);
    for (const [key, value] of original) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    // Delete only the exact file this test wrote, never arbitrary children.
    if (owned && fs.existsSync(owned)) {
      const info = fs.lstatSync(owned);
      const entries = info.isDirectory() && !info.isSymbolicLink()
        ? fs.readdirSync(owned) : [];
      if (info.isDirectory() && !info.isSymbolicLink() &&
          entries.length === 1 && entries[0] === sentinel) {
        const file = path.join(owned, sentinel);
        const fileInfo = fs.lstatSync(file);
        if (fileInfo.isFile() && !fileInfo.isSymbolicLink() &&
            fs.readFileSync(file, "utf8") === sentinelBytes) {
          fs.unlinkSync(file);
          fs.rmdirSync(owned);
        }
      }
    }
    if (fs.readdirSync(scratch).length === 1 &&
        fs.lstatSync(marker).isFile() && !fs.lstatSync(marker).isSymbolicLink() &&
        fs.readFileSync(marker, "utf8") === markerBytes) {
      fs.unlinkSync(marker);
      fs.rmdirSync(scratch);
    }
  }
});
