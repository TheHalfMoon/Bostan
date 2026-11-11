import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RUNNER_VENDOR_BUILD_COMMAND } from "../../scripts/prepare-runner-vendor.mjs";
import { copyServerBuildAssets } from "../../scripts/copy-build-assets.mjs";

const copierSource = readFileSync(
  fileURLToPath(new URL("../../scripts/copy-build-assets.mjs", import.meta.url)),
  "utf8",
);
const packageJsonPath = fileURLToPath(
  new URL("../../package.json", import.meta.url),
);
const runnerShimPath = fileURLToPath(
  new URL("../vendor/paperclip-runner/index.ts", import.meta.url),
);
const evidenceClassifierPath = fileURLToPath(
  new URL("../services/native-runtime/evidence-classifier.ts", import.meta.url),
);
const workspaceDiffReprojectionPath = fileURLToPath(
  new URL("../services/provider-trace-workspace-diff-reprojection.ts", import.meta.url),
);

describe("server package build script", () => {
  it("refuses to pack while the Bostan release lockdown is in force", () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.prepack).toBe("node ../scripts/bostan-release-disabled.mjs");
  });

  it("copies static runtime asset directories into dist", () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };
    const buildScript = packageJson.scripts?.build ?? "";
    // The portable copier (scripts/copy-build-assets.mjs, with its own
    // node:test suite) replaced the Unix-only mkdir/cp chain.
    expect(buildScript.split(" && ")).toContain("node scripts/copy-build-assets.mjs");
    expect(copierSource).toContain('["server/src/onboarding-assets","server/dist/onboarding-assets"]');
    expect(copierSource).toContain('["server/src/built-ins","server/dist/built-ins"]');
  });

  it("vendors the private runner runtime without a production workspace dependency", () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(
      packageJson.dependencies?.["@bostan/runner"],
    ).toBeUndefined();
    expect(packageJson.devDependencies?.["@bostan/runner"]).toBe(
      "workspace:*",
    );
    // prepare-runner-vendor.mjs reuses a Runner build whose recorded inputs
    // are unchanged (the `pnpm -r build` case) and otherwise runs the Runner's
    // full build, which is what a standalone server build (the Dockerfile's
    // path) relies on. Pin both the indirection and the command behind it.
    expect(packageJson.scripts?.["prepare:runner-vendor"]).toBe(
      "node scripts/prepare-runner-vendor.mjs",
    );
    expect(RUNNER_VENDOR_BUILD_COMMAND).toBe(
      "pnpm --filter @bostan/runner build",
    );
    expect(packageJson.scripts?.build.startsWith("pnpm run prepare:runner-vendor && ")).toBe(true);
    expect(copierSource).toContain('["packages/bostan-runner/dist","server/dist/vendor/paperclip-runner"]');
  });

  it("brackets the Runner's build with its input recording", () => {
    // The stamp prepare-runner-vendor.mjs trusts must only exist for a build
    // that completed every step and check, so it has to be written last; and
    // it must vouch for the inputs the build read, not for whatever the
    // sources are when it ends, so the digest has to be captured before the
    // first step reads anything (--begin) and compared again at the end
    // (--finish). Nothing else in the chain may touch the stamp.
    const runner = JSON.parse(readFileSync(new URL(
      "../../../packages/bostan-runner/package.json", import.meta.url,
    ), "utf8")) as { scripts: Record<string, string> };
    const steps = runner.scripts.build.split(" && ");
    expect(steps.at(0)).toBe("node scripts/record-build-inputs.mjs --begin");
    expect(steps.at(-1)).toBe("node scripts/record-build-inputs.mjs --finish");
    expect(steps.filter((step) => step.includes("record-build-inputs"))).toHaveLength(2);
    expect(steps.length).toBeGreaterThan(2);
  });

  it("replaces an existing read-only image manifest with the build's copy step", () => {
    const root = mkdtempSync(path.join(tmpdir(), "runner-vendor-copy-"));
    try {
      const write = (relative: string, content: string, mode?: number) => {
        mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
        writeFileSync(path.join(root, relative), content, mode === undefined ? undefined : { mode });
      };
      write("server/package.json", JSON.stringify({ name: "@bostan/server" }));
      for (const dir of ["server/src/onboarding-assets", "server/src/built-ins", "server/src/services/scripts"]) write(`${dir}/.keep`, "");
      for (const name of ["install-copilot-assets.mjs", "materialize-copilot-binary.mjs", "copilot-inner-distribution.mjs"]) {
        write(`packages/bostan-runner/scripts/${name}`, "");
      }
      const relative = "remote-provider-packs/linux-x64/provider-pack.json";
      const destination = path.join(root, "server/dist/vendor/paperclip-runner", relative);
      write(`packages/bostan-runner/dist/${relative}`, "qualified image identity", 0o444);
      write(`server/dist/vendor/paperclip-runner/${relative}`, "previous image identity", 0o444);
      copyServerBuildAssets(root);
      expect(readFileSync(destination, "utf8")).toBe("qualified image identity");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("verifies vendored runner dependencies are mirrored before building", () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };

    // See scripts/verify-runner-vendor-dependencies.mjs: packages/bostan-runner
    // is vendored with a raw copy of its compiled dist/, so every runtime
    // dependency it imports must also be a direct dependency of server. This
    // check derives that requirement from an esbuild scan of the vendored
    // entry points instead of relying on a human to have kept a hand-copied
    // list in sync (the smol-toml incident in #13110/#13116).
    expect(packageJson.scripts?.build).toContain(
      "node scripts/verify-runner-vendor-dependencies.mjs",
    );
  });

  it("compiles the vendored Runner's TypeScript surface once per build", () => {
    // prepare:runner-vendor runs the Runner's full build whenever its recorded
    // inputs are stale or missing (every standalone server build). Each extra
    // build:typescript inside that chain (two tsc projects plus the eval-kernel
    // rebuild) costs about 7s on the CI Build job's critical path.
    // Checks that read dist/ must call their script directly, the way
    // generate-replay-goldens.mjs already does, not through a `check:*`
    // wrapper that rebuilds first for standalone use.
    const runner = JSON.parse(readFileSync(new URL(
      "../../../packages/bostan-runner/package.json", import.meta.url,
    ), "utf8")) as { scripts: Record<string, string> };
    const steps = runner.scripts.build.split(" && ");
    const wrapped = steps
      .filter((step) => step.startsWith("pnpm run "))
      .map((step) => step.slice("pnpm run ".length));
    for (const name of wrapped) {
      expect(runner.scripts[name], `build step ${name}`).toBeDefined();
    }
    const compiles = (step: string) =>
      step === "build:typescript" || (runner.scripts[step] ?? "").includes("build:typescript");

    expect(wrapped.filter(compiles)).toEqual(["build:typescript"]);
    expect(steps).toContain("node scripts/generate-semantic-contracts.mjs --check");
    expect(steps).toContain("node scripts/check-runner-workflow-traceability.mjs");
    expect(steps.indexOf("node scripts/generate-semantic-contracts.mjs --check"))
      .toBeGreaterThan(steps.indexOf("pnpm run build:typescript"));
    expect(steps.indexOf("node scripts/check-runner-workflow-traceability.mjs"))
      .toBeGreaterThan(steps.indexOf("pnpm run build:typescript"));
  });

  it("ships the pinned OpenCode dependency resolved by the vendored Runner", () => {
    const server = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    const runner = JSON.parse(readFileSync(new URL(
      "../../../packages/bostan-runner/package.json", import.meta.url,
    ), "utf8"));
    // createRequire resolution is dynamic and is not covered by the import scan.
    expect(server.dependencies["opencode-ai"]).toBe("1.18.34");
    expect(server.dependencies["opencode-ai"]).toBe(runner.dependencies["opencode-ai"]);
  });

  it("loads runner source when the source server starts before workspace builds", () => {
    const shim = readFileSync(runnerShimPath, "utf8");

    expect(shim).toContain(
      '"../../../../packages/bostan-runner/src/index.ts"',
    );
    expect(shim).not.toContain(
      'export * from "@bostan/runner"',
    );
  });

  it("routes source-mode runtime imports through the runner shim", () => {
    for (const consumerPath of [
      evidenceClassifierPath,
      workspaceDiffReprojectionPath,
    ]) {
      const consumer = readFileSync(consumerPath, "utf8");

      expect(consumer).toContain('vendor/paperclip-runner/index.js"');
      expect(consumer).not.toContain('from "@bostan/runner"');
    }
  });
});
