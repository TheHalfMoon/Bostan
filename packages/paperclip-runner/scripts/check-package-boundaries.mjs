import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const evalKernelRoot = resolve(packageRoot, "../bostan-eval-kernel");
const runnerManifest = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));
const evalKernelManifest = JSON.parse(await readFile(resolve(evalKernelRoot, "package.json"), "utf8"));
const lockfile = await readFile(resolve(packageRoot, "../../pnpm-lock.yaml"), "utf8");
const runnerImporter = lockfile.split("\n  packages/paperclip-runner:\n")[1]?.split(/\n  [^ ]+:/)[0] ?? "";
const runtimeIndex = await readFile(resolve(packageRoot, "src/index.ts"), "utf8");

const violations = [];
if (evalKernelManifest.name !== "@bostan/eval-kernel") {
  violations.push("Runner eval package must have its native Bostan workspace identity");
}
if (runnerManifest.devDependencies?.["@bostan/eval-kernel"] !== "workspace:*") {
  violations.push("Runner must declare the private Bostan eval kernel as a workspace development dependency");
}
if (!/\n      '@bostan\/eval-kernel':\n        specifier: workspace:\*\n        version: link:\.\.\/bostan-eval-kernel(?:\n|$)/.test(runnerImporter)) {
  violations.push("Runner frozen lockfile must link the real Bostan eval kernel directory");
}
if (runnerManifest.exports?.["./testing"] === undefined) {
  violations.push("runner package must declare the ./testing export");
}
if (runnerManifest.exports?.["./evals"] === undefined) {
  violations.push("runner package must declare the ./evals integration export");
}
if (evalKernelManifest.private !== true) {
  violations.push("generic eval kernel must remain a workspace-private development package");
}
for (const privatePath of ["mock-core", "conformance", "scenarios", "src/tools", "./tools/"]) {
  if (runtimeIndex.includes(privatePath)) {
    violations.push(`runtime root must not export test/eval path: ${privatePath}`);
  }
}

const runtimeDependencyGroups = [
  runnerManifest.dependencies ?? {},
  runnerManifest.optionalDependencies ?? {},
  runnerManifest.peerDependencies ?? {},
];
for (const dependency of runtimeDependencyGroups.flatMap((group) => Object.keys(group))) {
  if (dependency.includes("eval")) {
    violations.push(`runner runtime must not depend on eval package: ${dependency}`);
  }
}
if (runnerManifest.dependencies?.ajv === undefined || runnerManifest.devDependencies?.ajv !== undefined) {
  violations.push("ajv must be declared as a runtime dependency because the public dispatcher imports it");
}

for (const dependency of Object.keys({
  ...(evalKernelManifest.dependencies ?? {}),
  ...(evalKernelManifest.optionalDependencies ?? {}),
  ...(evalKernelManifest.peerDependencies ?? {}),
})) {
  if (dependency === "@paperclipai/paperclip-runner") {
    violations.push("generic eval kernel must use structural callbacks, not a runner runtime dependency");
  }
}
if (evalKernelManifest.files?.some((entry) => /scenario|fixture|corpus/.test(entry))) {
  violations.push("generic eval kernel package inventory must not include scenario content");
}

if (violations.length > 0) {
  process.stderr.write(`Package boundary check failed:\n${violations.map((item) => `- ${item}`).join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Package boundary check passed: runtime, testing, and eval ownership is acyclic.\n");
}
