/**
 * Fail-closed, bounded diagnostic projection for the private Windows HTTP QA.
 * Server stderr is observational input, not an authority to print paths,
 * tokens, or arbitrary module labels in the parent process's evidence.
 */
const CLASSES = new Set(['third_party', 'external_file', 'virtual_or_builtin', 'other_repo_file']);
const MODULE_PATH = /^(?:server\/src|packages)\/[A-Za-z0-9_ .\/-]+\.(?:ts|tsx|js|mjs|cjs)$/;

function safeModule(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 170) return false;
  if (CLASSES.has(value)) return true;
  if (!MODULE_PATH.test(value)) return false;
  const parts = value.split('/');
  return parts.length <= 16 && parts.every(part => part !== '' && part !== '.' && part !== '..');
}
function count(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 10_000_000;
}
function duration(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000;
}

export function sanitizePrivateWindowsModuleProfile(raw) {
  if (typeof raw !== 'string' || raw.length < 2 || raw.length > 4096) return null;
  let value;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      value.schema !== 'bostan.private-module-load-profile.v1' ||
      !count(value.loadCount) || !count(value.errorCount) ||
      !duration(value.loadMs) || !Array.isArray(value.topLoads) ||
      value.topLoads.length > 5) return null;
  const topLoads = [];
  for (const item of value.topLoads) {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
        !safeModule(item.module) || !duration(item.loadMs)) return null;
    topLoads.push({module:item.module,loadMs:item.loadMs});
  }
  return Object.freeze({loadCount:value.loadCount,loadMs:value.loadMs,
    errorCount:value.errorCount,topLoads:Object.freeze(topLoads)});
}
