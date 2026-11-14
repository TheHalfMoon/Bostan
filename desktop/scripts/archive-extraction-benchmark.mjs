import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { createPackagingStage } from "./packaging-stage.mjs";

// Diagnostic only: this never installs/registers an app or supplies acceptance.
export function benchmarkArchiveExtraction(tool, archive, parent, timeoutMs = 300000) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300000) throw new Error("Invalid extraction diagnostic deadline");
  const stage = createPackagingStage(parent);
  try {
    fs.mkdirSync(stage.directory);
    const started = Date.now();
    // This pinned 7za scans the EXE for its embedded7z payload. Refuse a
    // different handler/envelope rather than mislabeling its timing as runtime.
    const inventory = spawnSync(tool, ["l", "-slt", archive], {
      windowsHide: true, encoding: "utf8", timeout: Math.min(timeoutMs, 30000), maxBuffer: 64 * 1024 * 1024,
    });
    const listing = inventory.stdout ?? "";
    const header = listing.slice(0, listing.indexOf("----------"));
    const paths = new Set();
    for (const match of listing.matchAll(/^Path = (.+)\r?$/gm)) paths.add(match[1].replace(/\r$/, "").replaceAll("\\", "/"));
    const payloadRecognized = inventory.status === 0 && !inventory.error && /^Type = 7z\r?$/m.test(header)
      && ["Bostan.exe", "resources/runtime/dist/index.js", "resources/runtime/ui-dist/index.html"]
        .every(name => paths.has(name));
    if (!payloadRecognized) return { diagnosticOnly: true, payloadRecognized: false, completed: false,
      elapsedMs: Date.now() - started, timedOut: inventory.error?.code === "ETIMEDOUT", failed: true };
    const inventoryMs = Date.now() - started;
    const remainingMs = timeoutMs - inventoryMs;
    if (remainingMs <= 0) return { diagnosticOnly: true, payloadRecognized: true, completed: false,
      elapsedMs: Date.now() - started, timedOut: true, failed: true };
    const extractionStarted = Date.now();
    const result = spawnSync(tool, ["x", "-y", "-bd", "-bso0", "-bsp0", "-bse0", "-o" + stage.directory, archive], {
      windowsHide: true, stdio: "ignore", timeout: remainingMs,
    });
    return { diagnosticOnly: true, payloadRecognized: true, completed: result.status === 0 && !result.error && !result.signal,
      inventoryMs, extractionMs: Date.now() - extractionStarted, elapsedMs: Date.now() - started, timedOut: result.error?.code === "ETIMEDOUT",
      failed: result.status !== 0 || Boolean(result.error) || Boolean(result.signal) };
  } finally { stage.dispose(); }
}
