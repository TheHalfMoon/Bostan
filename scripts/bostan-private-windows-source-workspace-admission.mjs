/**
 * Native Windows source HTTP QA: preflight direct package-scoped dependency
 * resolution before creating PostgreSQL scratch state or spawning a server.
 * Node resolution alone may silently use a borrowed parent install or an
 * out-of-checkout package symlink; neither proves an owned QA workspace.
 */
import { createRequire } from 'node:module';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const SCOPES = Object.freeze(['server', 'packages/adapter-utils', 'packages/paperclip-runner']);
const DEPENDENCY = 'smol-toml';
const refuse = reason => Object.freeze({ allowed: false, reason });

function inside(parent, child) {
  if (typeof child !== 'string' || !isAbsolute(child)) return false;
  const rel = relative(parent, child);
  return rel !== '' && rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel);
}

// A valid package manifest and in-checkout resolution do not establish that
// its workspace scope is an ordinary directory. A junction in any scope
// ancestor can redirect the source tree before the dependency check runs.
function ordinaryWorkspaceScope(root, scope) {
  let current = root;
  try {
    for (const component of scope.split('/')) {
      current = join(current, component);
      const stat = lstatSync(current);
      if (!stat.isDirectory() || stat.isSymbolicLink()) return false;
    }
    return true;
  } catch { return false; }
}

export function checkPrivateWindowsSourceWorkspaceDependencies({
  root,
  resolveDependency = (manifest, name) => createRequire(manifest).resolve(name),
} = {}) {
  if (typeof root !== 'string' || !isAbsolute(root) || resolve(root) !== root ||
      typeof resolveDependency !== 'function') return refuse('invalid_source_root');
  try {
    const rootStat = lstatSync(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return refuse('invalid_source_root');
  } catch { return refuse('invalid_source_root'); }
  for (const scope of SCOPES) {
    if (!ordinaryWorkspaceScope(root, scope)) return refuse('foreign_workspace_scope');
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

    // Every scope must have its own direct package entry, not merely a
    // hoisted or borrowed ancestor dependency that happens to resolve.
    const modules = join(root, scope, 'node_modules');
    const packageLink = join(modules, DEPENDENCY);
    let physicalPackage;
    try {
      const modulesStat = lstatSync(modules);
      if (!modulesStat.isDirectory() || modulesStat.isSymbolicLink())
        return refuse('foreign_workspace_dependency');
      const linkStat = lstatSync(packageLink);
      if (!linkStat.isDirectory() && !linkStat.isSymbolicLink())
        return refuse('missing_workspace_dependency');
      physicalPackage = realpathSync(packageLink);
      if (!lstatSync(physicalPackage).isDirectory())
        return refuse('missing_workspace_dependency');
    } catch { return refuse('missing_workspace_dependency'); }
    // pnpm symlinks to this checkout's own node_modules/.pnpm are allowed;
    // paths into other checkouts or operator-controlled directories are not.
    if (!inside(root, physicalPackage)) return refuse('foreign_workspace_dependency');
    // The directory name alone is not proof of package identity. A malicious
    // or incomplete install can resolve an arbitrary index.js under this
    // directory while claiming to provide the declared dependency.
    try {
      const packageManifest = join(physicalPackage, 'package.json');
      const info = lstatSync(packageManifest);
      if (!info.isFile() || info.isSymbolicLink() || info.size < 2 || info.size > 131072)
        return refuse('invalid_workspace_dependency_identity');
      const physicalManifest = realpathSync(packageManifest);
      if (!inside(physicalPackage, physicalManifest) || !inside(root, physicalManifest))
        return refuse('invalid_workspace_dependency_identity');
      const identity = JSON.parse(readFileSync(packageManifest, 'utf8'));
      if (!identity || typeof identity !== 'object' || Array.isArray(identity) ||
          identity.name !== DEPENDENCY) return refuse('invalid_workspace_dependency_identity');
    } catch { return refuse('invalid_workspace_dependency_identity'); }
    try {
      const located = resolveDependency(manifest, DEPENDENCY);
      if (typeof located !== 'string' || !isAbsolute(located))
        return refuse('missing_workspace_dependency');
      const physicalFile = realpathSync(located);
      if (!inside(physicalPackage, physicalFile) || !inside(root, physicalFile))
        return refuse('foreign_workspace_dependency');
      const fileStat = lstatSync(physicalFile);
      if (!fileStat.isFile() || fileStat.isSymbolicLink())
        return refuse('missing_workspace_dependency');
    } catch { return refuse('missing_workspace_dependency'); }
  }
  return Object.freeze({ allowed: true, reason: 'pass' });
}
