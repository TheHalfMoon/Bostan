#!/usr/bin/env -S node --import tsx
import fs from "node:fs/promises";
import {
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import path from "node:path";
import { repoRoot } from "./dev-service-profile.ts";

type WorkspaceLink = {
  packageName: string;
  expectedPath: string;
  linkPath: string;
  nodeModulesDir: string;
  scopeDir: string | null;
};

// Package names become relative filesystem components. Validate the whole
// name before constructing any destination path, including discovered names.
const VALID_PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
function assertPackageName(name: unknown): asserts name is string {
  if (typeof name !== "string" || !VALID_PACKAGE_NAME.test(name)) {
    throw Error("BOSTAN_WORKSPACE_LINKS_REFUSED=invalid_package_name");
  }
}

function readJsonFile(filePath: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw Error("BOSTAN_WORKSPACE_LINKS_REFUSED=invalid_manifest");
  }
  return parsed as Record<string, unknown>;
}

function inspectRealDirectory(dir: string, reason: string): void {
  let info;
  try { info = lstatSync(dir); }
  catch { throw Error(`BOSTAN_WORKSPACE_LINKS_REFUSED=${reason}`); }
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw Error(`BOSTAN_WORKSPACE_LINKS_REFUSED=${reason}`);
  }
}

// A dangling link is an existing filesystem object and must never be
// treated as a missing dependency. lstatSync does not follow symlinks.
function pathState(file: string): "missing" | "symlink" | "other" {
  try {
    return lstatSync(file).isSymbolicLink() ? "symlink" : "other";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    throw Error("BOSTAN_WORKSPACE_LINKS_REFUSED=link_inspection_failed");
  }
}

function discoverWorkspacePackagePaths(rootDir: string): Map<string, string> {
  const packagePaths = new Map<string, string>();
  const ignored = new Set([".git", ".paperclip", "dist", "node_modules"]);
  function visit(dir: string): void {
    inspectRealDirectory(dir, "untrusted_workspace_directory");
    const packageJsonPath = path.join(dir, "package.json");
    if (pathState(packageJsonPath) !== "missing") {
      const info = lstatSync(packageJsonPath);
      if (!info.isFile() || info.isSymbolicLink()) {
        throw Error("BOSTAN_WORKSPACE_LINKS_REFUSED=invalid_manifest");
      }
      const manifest = readJsonFile(packageJsonPath);
      if (manifest.name !== undefined) {
        assertPackageName(manifest.name);
        if (packagePaths.has(manifest.name)) {
          throw Error("BOSTAN_WORKSPACE_LINKS_REFUSED=duplicate_workspace_name");
        }
        packagePaths.set(manifest.name, dir);
      }
    }
    for (const child of readdirSync(dir, { withFileTypes: true })) {
      if (!child.isDirectory() || ignored.has(child.name)) continue;
      visit(path.join(dir, child.name));
    }
  }
  for (const dirname of ["packages", "server", "ui", "cli"]) {
    visit(path.join(rootDir, dirname));
  }
  return packagePaths;
}

const packagePaths = discoverWorkspacePackagePaths(repoRoot);
const workspaceDirs = [...new Set([...packagePaths.values()])].sort();
const planned: WorkspaceLink[] = [];

// Phase 1: verify all scopes, names, parents and existing targets across the
// entire workspace before creating anything. Never unlink an existing entry.
for (const dir of workspaceDirs) {
  const manifest = readJsonFile(path.join(dir, "package.json"));
  const dependencies = {
    ...(manifest.dependencies as Record<string, unknown> | undefined),
    ...(manifest.devDependencies as Record<string, unknown> | undefined),
  };
  const requested = Object.entries(dependencies).filter(([, value]) =>
    typeof value === "string" && value.startsWith("workspace:"),
  );
  if (!requested.length) continue;
  const nodeModulesDir = path.join(dir, "node_modules");
  inspectRealDirectory(nodeModulesDir, "missing_or_linked_node_modules");
  for (const [name] of requested) {
    assertPackageName(name);
    const expectedPath = packagePaths.get(name);
    if (!expectedPath) {
      throw Error("BOSTAN_WORKSPACE_LINKS_REFUSED=unresolved_workspace_package");
    }
    inspectRealDirectory(expectedPath, "untrusted_workspace_directory");
    const components = name.split("/");
    const scopeDir = components.length === 2 ? path.join(nodeModulesDir, components[0]!) : null;
    if (scopeDir !== null && pathState(scopeDir) !== "missing") {
      inspectRealDirectory(scopeDir, "linked_or_untrusted_scope");
    }
    const linkPath = path.join(nodeModulesDir, ...components);
    const state = pathState(linkPath);
    if (state === "symlink") {
      let actual: string;
      try { actual = realpathSync(linkPath); }
      catch { throw Error("BOSTAN_WORKSPACE_LINKS_REFUSED=dangling_link"); }
      if (actual !== realpathSync(expectedPath)) {
        throw Error("BOSTAN_WORKSPACE_LINKS_REFUSED=foreign_link");
      }
      continue;
    }
    if (state === "other") {
      throw Error("BOSTAN_WORKSPACE_LINKS_REFUSED=existing_nonlink_entry");
    }
    planned.push({ packageName: name, expectedPath, linkPath, nodeModulesDir, scopeDir });
  }
}

// Phase 2: create missing links only. Recheck just before writing. If a
// concurrent actor changes a path, fail rather than deleting/replacing it.
for (const link of planned) {
  inspectRealDirectory(link.nodeModulesDir, "changed_node_modules");
  if (link.scopeDir !== null) {
    if (pathState(link.scopeDir) === "missing") {
      try { await fs.mkdir(link.scopeDir); }
      catch { throw Error("BOSTAN_WORKSPACE_LINKS_REFUSED=scope_create_failed"); }
    }
    inspectRealDirectory(link.scopeDir, "changed_scope");
  }
  if (pathState(link.linkPath) !== "missing") {
    throw Error("BOSTAN_WORKSPACE_LINKS_REFUSED=link_changed_before_creation");
  }
  // On Windows, junctions avoid requiring symlink-developer privileges.
  // fs.symlink fails with EEXIST rather than replacing a foreign entry.
  try {
    await fs.symlink(link.expectedPath, link.linkPath,
      process.platform === "win32" ? "junction" : "dir");
  } catch {
    throw Error("BOSTAN_WORKSPACE_LINKS_REFUSED=link_create_failed");
  }
}

console.log(`BOSTAN_WORKSPACE_LINKS_OK=${planned.length}`);
