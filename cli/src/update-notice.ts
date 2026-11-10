import fs from "node:fs";
import { resolveConfigPath } from "./config/store.js";
export function isUpdateNoticeEnabled(configPath?: string): boolean {
  if (process.env.PAPERCLIP_UPDATE_CHECK === "0") return false;
  try { const raw = JSON.parse(fs.readFileSync(resolveConfigPath(configPath), "utf8")) as { updates?: { checkEnabled?: boolean } }; return raw.updates?.checkEnabled !== false; } catch { return true; }
}
/**
 * Bostan has no published release channel, and the inherited check queried the
 * upstream `paperclipai` npm package on every `run` and `doctor`. No network
 * request is made; this always reports no update.
 */
export async function checkForUpdateNotice(_options: { configPath?: string; now?: number; fetchImpl?: typeof fetch; cachePath?: string } = {}): Promise<string | null> {
  return null;
}
export async function printUpdateNotice(configPath?: string): Promise<void> { const latest = await checkForUpdateNotice({ configPath }); if (latest) console.log(`Update available: ${latest} — run \`paperclipai update\``); }
