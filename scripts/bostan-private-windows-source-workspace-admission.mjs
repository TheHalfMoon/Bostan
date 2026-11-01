/**
 * Test-only source HTTP QA: reject missing workspace-scoped imports BEFORE
 * creating any disposable PostgreSQL database or starting a child process.
 * A package declaration alone does not prove its installed Node resolution.
 */
import { createRequire } from 'node:module';
import { lstatSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

const SCOPES = Object.freeze(['server', 'packages/adapter-utils', 'packages/paperclip-runner']);
const DEPENDENCY = 'smol-toml';
const refuse = reason => Object.freeze({ allowed: false, reason });

export function checkPrivateWindowsSourceWorkspaceDependencies({
  root,
  resolveDependency = (manifest, name) => createRequire(manifest).resolve(name),
} = {}) {
  if (typeof root !== 'string' || !isAbsolute(root) || resolve(root) !== root ||
      typeof resolveDependency !== 'function') return refuse('invalid_source_root');
  for (const scope of SCOPES) {
    const manifest = join(root, scope, 'package.json');
    let parsed;
    try {
      const stat = lstatSync(manifest);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > 131072)
        return refuse('invalid_workspace_manifest');
      parsed = JSON.parse(readFileSync(manifest, 'utf8'));
    } catch { return refuse('invalid_workspace_manifest'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
        typeof parsed.dependencies?.[DEPENDENCY] !== 'string' ||
        parsed.dependencies[DEPENDENCY].length === 0)
      return refuse('undeclared_workspace_dependency');
    try {
      const located = resolveDependency(manifest, DEPENDENCY);
      if (typeof located !== 'string' || located.length === 0)
        return refuse('missing_workspace_dependency');
    } catch { return refuse('missing_workspace_dependency'); }
  }
  return Object.freeze({ allowed: true, reason: 'pass' });
}
