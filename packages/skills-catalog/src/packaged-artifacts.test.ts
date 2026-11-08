import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// npm and pnpm are .cmd shims on Windows; the arguments below are constants.
const useShell = process.platform === "win32";

// Packaging is locked down (prepack runs scripts/bostan-release-disabled.mjs),
// so list the would-be artifact without lifecycle scripts or writing a tarball.
function readPackMetadata() {
  const output = execFileSync("npm", ["pack", "--dry-run", "--ignore-scripts", "--json"], {
    cwd: packageRoot,
    encoding: "utf8",
    shell: useShell,
  });
  const metadata = JSON.parse(output);
  if (!Array.isArray(metadata) || metadata.length === 0 || typeof metadata[0]?.filename !== "string") {
    throw new Error(`Unexpected npm pack output from ${packageRoot}: ${output}`);
  }
  return metadata[0] as { filename: string; files: Array<{ path: string }> };
}

describe("skills catalog package artifacts", () => {
  it("packs dist manifest and catalog files for npm artifact consumers", () => {
    let metadata = readPackMetadata();

    if (!metadata.files.some((entry) => entry.path === "dist/generated/catalog.json")) {
      execFileSync("pnpm", ["--filter", "@bostan/skills-catalog", "build"], {
        cwd: packageRoot,
        stdio: "ignore",
        shell: useShell,
      });
      metadata = readPackMetadata();
    }

    const paths = metadata.files.map((entry) => entry.path);

    expect(paths).toContain("dist/generated/catalog.json");
    expect(paths).toContain("generated/catalog.json");
    expect(paths).toContain("catalog/bundled/software-development/github-pr-workflow/SKILL.md");
    expect(paths).toContain("catalog/optional/browser/agent-browser/SKILL.md");
    expect(paths).toContain("package.json");
  }, 120_000);
});
