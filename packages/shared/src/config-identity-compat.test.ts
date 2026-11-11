import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import * as publicApi from "./index.js";
import * as config from "./config-schema.js";
import * as home from "./home-paths.js";

describe("Bostan configuration API compatibility", () => {
  it("keeps legacy package-root imports bound to the canonical schema and helpers", () => {
    expect(publicApi.bostanConfigSchema).toBe(config.bostanConfigSchema);
    expect(publicApi.paperclipConfigSchema).toBe(config.bostanConfigSchema);
    expect(publicApi.mergePaperclipConfig).toBe(config.mergeBostanConfig);
    expect(publicApi.findPaperclipConfigKeyWarnings).toBe(config.findBostanConfigKeyWarnings);
    expect(config.paperclipConfigSchema).toBe(config.bostanConfigSchema);
  });

  it("resolves the same existing instance and secret/storage locations through both API spellings", () => {
    const homeDir = path.join(os.tmpdir(), "bostan-config-compat");
    const input = { homeDir, instanceId: "existing_instance" };
    const root = path.join(homeDir, "instances", "existing_instance");
    expect(home.resolveBostanInstanceRoot(input)).toBe(root);
    expect(home.resolvePaperclipInstanceRoot(input)).toBe(root);
    expect(home.resolveBostanConfigPathForInstance(input)).toBe(home.resolvePaperclipConfigPathForInstance(input));
    expect(home.resolveBostanInstanceConfigPath(input)).toBe(path.join(root, "config.json"));
    expect(home.resolveDefaultSecretsKeyFilePath(input)).toBe(path.join(root, "secrets", "master.key"));
    expect(home.resolveDefaultStorageDir(input)).toBe(path.join(root, "data", "storage"));
    expect(home.resolveBostanHomeDir).toBe(home.resolvePaperclipHomeDir);
    expect(home.resolveBostanInstanceId).toBe(home.resolvePaperclipInstanceId);
    expect(home.resolveBostanEnvPathForConfig).toBe(home.resolvePaperclipEnvPathForConfig);
  });
});
