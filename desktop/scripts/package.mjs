import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeCandidateChecksums } from "./artifact-checksums.mjs";
import { createRequire } from "node:module";
import { prepareRuntimeLinks } from "../app/runtime-links.mjs";
import { resolvePnpmInvocation } from "../../server/scripts/prepare-runner-vendor.mjs";
import { inspectLinks, verifyStage } from "../../scripts/bostan-private-staged-server-check.mjs";
import { createPackagingStage } from "./packaging-stage.mjs";
import { captureRuntimePayload, verifyPackagedRuntime, runtimeResourceEntries } from "./packaging-runtime.mjs";

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.dirname(desktop);
const require = createRequire(path.join(desktop, "package.json"));
const { build } = require("electron-builder");
const out = path.join(desktop, "dist");
const pkg = JSON.parse(fs.readFileSync(path.join(desktop, "package.json"), "utf8"));
for (const required of ["server/dist/index.js", "server/dist/build-info.json", "ui/dist/index.html"]) {
  if (!fs.statSync(path.join(repo, required), { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Missing ${required}; build the server and UI before packaging`);
  }
}
fs.mkdirSync(out, { recursive: true });
// pnpm 9 computes workspace-relative module/bin paths during deploy. Keep the
// stage inside the workspace, but outside the output tree builder replaces.
const ownedStage = createPackagingStage(desktop);
const stage = ownedStage.directory;
try {
  const pnpm = resolvePnpmInvocation();
  if (/[&|<>^%"\r\n]/.test(repo + stage)) throw new Error("Unsupported shell characters in build path");
  const result = spawnSync(pnpm.command, [...pnpm.argsPrefix,
    "--filter", "@bostan/server", "deploy", "--prod", "--ignore-scripts", stage], {
    cwd: repo, stdio: "inherit", shell: pnpm.command === "pnpm" && process.platform === "win32",
    windowsHide: true,
  });
  if (result.status !== 0 || result.error) throw new Error("Bostan production runtime staging failed");
  // pnpm 9 creates one source self-reference. Repair only that exact link in
  // this newly allocated stage; every other escaping dependency is rejected.
  const self = path.join(stage, "node_modules/.pnpm/node_modules/@bostan/server");
  if (fs.lstatSync(self, { throwIfNoEntry: false })?.isSymbolicLink()) {
    const target = fs.realpathSync(self);
    if (target !== stage) {
      if (target !== fs.realpathSync(path.join(repo, "server"))) throw new Error("Unexpected pnpm self reference");
      fs.unlinkSync(self);
      fs.symlinkSync(stage, self, process.platform === "win32" ? "junction" : "dir");
    }
  }
  fs.cpSync(path.join(repo, "ui/dist"), path.join(stage, "ui-dist"), { recursive: true });
  verifyStage(stage);
  inspectLinks(stage);
  const components = new Map();
  const licenses = new Map();
  function inventory(directory) {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, item.name);
      if (item.isSymbolicLink()) continue;
      if (item.isDirectory()) inventory(file);
      else if (item.name === "package.json") {
        const value = JSON.parse(fs.readFileSync(file, "utf8"));
        if (typeof value.name === "string" && typeof value.version === "string") {
          components.set(`${value.name}@${value.version}`, { type: "library", name: value.name, version: value.version });
          const notices = fs.readdirSync(directory).filter(name => /^(?:licen[sc]e|copying|notice)(?:[._-]|$)/i.test(name));
          licenses.set(`${value.name}@${value.version}`, {
            name: value.name, version: value.version, declaredLicense: value.license ?? "UNDECLARED",
            noticeFiles: notices.map(name => path.relative(stage, path.join(directory, name)).split(path.sep).join("/")),
          });
        }
      }
    }
  }
  inventory(stage);
  const bom = {
    bomFormat: "CycloneDX", specVersion: "1.6", serialNumber: `urn:uuid:${randomUUID()}`, version: 1,
    metadata: { timestamp: new Date().toISOString(), component: { type: "application", name: "Bostan", version: pkg.version } },
    components: [...components.values(), { type: "framework", name: "electron", version: pkg.devDependencies.electron }],
  };
  fs.writeFileSync(path.join(out, "bostan-sbom.cdx.json"), JSON.stringify(bom, null, 2) + "\n");
  fs.writeFileSync(path.join(out, "bostan-license-inventory.json"), JSON.stringify({
    schema: "bostan.license-inventory.v1", thirdPartyLicenseReviewComplete: false,
    components: [...licenses.values()],
    electronNotices: ["LICENSE.electron.txt", "LICENSES.chromium.html"],
  }, null, 2) + "\n");
  prepareRuntimeLinks(stage);
  const payload = await captureRuntimePayload(stage);
  // Artifact preparation is authorized; signing and publication are not.
  for (const key of ["CSC_LINK", "CSC_KEY_PASSWORD", "WIN_CSC_LINK", "WIN_CSC_KEY_PASSWORD", "CSC_NAME"]) delete process.env[key];
  process.env.CSC_IDENTITY_AUTO_DISCOVERY = "false";
  const artifacts = await build({
    projectDir: desktop, publish: "never",
    config: {
      extraResources: runtimeResourceEntries(stage, payload),
      afterPack: context => verifyPackagedRuntime(context, payload),
    },
  });
  await writeCandidateChecksums(out, artifacts);
  console.log("Bostan unsigned artifacts prepared; signing, notarization and publication remain separate gates.");
} finally {
  ownedStage.dispose();
}
