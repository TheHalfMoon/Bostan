/**
 * One admission shared by source and compiled native Windows private HTTP QA.
 * This runs BEFORE either server entry imports the application. Never accept
 * arbitrary user profiles, managed-cloud settings or non-local PostgreSQL.
 */
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { basename, isAbsolute } from 'node:path';
import { parsePrivateWindowsQaWave } from './bostan-private-windows-qa-wave.mjs';

export function isPrivateWindowsQaEntryAllowed({
  root, env = process.env, platform = process.platform,
} = {}) {
  if (platform !== 'win32' || typeof root !== 'string' ||
      !parsePrivateWindowsQaWave(basename(root.replace(/[\\/]+$/, '')), 'qa') ||
      !env || typeof env !== 'object' ||
      env.BOSTAN_PRIVATE_QA_ENTRY !== 'B087_TEST_ONLY' ||
      env.PAPERCLIP_DEPLOYMENT_MODE !== 'authenticated' ||
      env.PAPERCLIP_DEPLOYMENT_EXPOSURE !== 'private' ||
      Object.keys(env).some(key => /^(PAPERCLIP_CLOUD_|BOSTAN_CLOUD_|PAPERCLIP_MANAGED_CONFIG$)/i.test(key))) {
    return false;
  }
  const marker = env.BOSTAN_PRIVATE_QA_MARKER;
  if (typeof marker !== 'string' || !isAbsolute(marker) ||
      basename(marker) !== 'BOSTAN_QA_OWNED') return false;
  let database;
  try { database = new URL(env.DATABASE_URL); } catch { return false; }
  if (!['postgres:', 'postgresql:'].includes(database.protocol) ||
      database.hostname !== '127.0.0.1' ||
      !Number.isInteger(Number(database.port)) || Number(database.port) <= 1023 ||
      Number(database.port) > 65535) return false;
  try {
    const info = lstatSync(marker);
    return existsSync(marker) && info.isFile() && !info.isSymbolicLink() &&
      readFileSync(marker, 'utf8') === 'BOSTAN_PRIVATE_SYNTHETIC_ONLY\n';
  } catch { return false; }
}
