import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  buildReleasePackagePlan,
  discoverPublicPackages,
  checkConfiguration,
  findUnpublishableWorkspaceEdges,
  getReleasePackages,
} from "./release-package-map.mjs";

function pkg(name, { publishFromCi, ...deps } = {}) {
  return { name, dir: name, publishFromCi, pkg: { name, ...deps } };
}

test("Bostan release inventory uses portable slash-separated package identifiers", () => {
  const packages = discoverPublicPackages();
  assert.deepEqual(packages, [], "no Bostan source package should be eligible for public registry publishing");
});

test("release package manifest covers all public packages with explicit CI enrollment", () => {
  const packages = buildReleasePackagePlan();
  assert.deepEqual(packages, [], "private Bostan release plan should have no public packages");
});

test("Bostan legacy release list refuses all publishing while the product is private", () => {
  assert.throws(() => getReleasePackages(), /Bostan publishing disabled/);
});

test("Bostan CLI is private and the inherited release manifest enables no packages", () => {
  const plan = buildReleasePackagePlan();
  assert.deepEqual(plan, [], "Bostan must have zero registry-release candidates");
});

test("all package manifest entries are explicitly disabled for inherited release", () => {
  const plan = buildReleasePackagePlan();
  assert.deepEqual(plan, []);
  const manifest = JSON.parse(readFileSync(new URL("./release-package-manifest.json", import.meta.url), "utf8"));
  assert.ok(manifest.every((entry) => entry.publishFromCi === false));
  for (const category of ["skills", "teams"]) {
    const packagePath = new URL(`../packages/${category}-catalog/package.json`, import.meta.url);
    const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
    assert.equal(pkg.private, true);
    assert.equal(pkg.publishConfig, undefined);
    assert.ok(manifest.some((entry) => entry.dir === `packages/${category}-catalog` && entry.publishFromCi === false));
  }
});

test("Bostan Hermes and its compatibility shim are private and absent from public release inventory", () => {
  const packages = buildReleasePackagePlan();
  for (const [dir, name] of [["hermes", "@bostan/adapter-hermes"], ["hermes-gateway", "@bostan/adapter-hermes-gateway"]]) {
    assert.equal(packages.find((pkg) => pkg.name === name), undefined);
    const manifest = JSON.parse(readFileSync(new URL(`../packages/adapters/${dir}/package.json`, import.meta.url), "utf8"));
    assert.equal(manifest.name, name);
    assert.equal(manifest.private, true);
    assert.match(manifest.scripts.prepack, /bostan-release-disabled/);
  }
});

test("release package configuration validates successfully", () => {
  assert.doesNotThrow(() => checkConfiguration());
});

test("guard flags a publishFromCi:true package depending on a publishFromCi:false package", () => {
  const problems = findUnpublishableWorkspaceEdges([
    pkg("@bostan/server", {
      publishFromCi: true,
      dependencies: { "@bostan/skills-catalog": "workspace:*" },
    }),
    pkg("@bostan/skills-catalog", { publishFromCi: false }),
  ]);

  assert.equal(problems.length, 1);
  assert.match(problems[0], /@bostan\/server/);
  assert.match(problems[0], /@bostan\/skills-catalog/);
});

test("guard inspects optional and peer dependency sections too", () => {
  const problems = findUnpublishableWorkspaceEdges([
    pkg("@bostan/server", {
      publishFromCi: true,
      optionalDependencies: { "@paperclipai/opt": "workspace:^" },
      peerDependencies: { "@paperclipai/peer": "workspace:*" },
    }),
    pkg("@paperclipai/opt", { publishFromCi: false }),
    pkg("@paperclipai/peer", { publishFromCi: false }),
  ]);

  assert.equal(problems.length, 2);
});

test("guard treats a workspace dep on an unknown @paperclipai package as unpublishable", () => {
  const problems = findUnpublishableWorkspaceEdges([
    pkg("@bostan/server", {
      publishFromCi: true,
      dependencies: { "@paperclipai/private-internal": "workspace:*" },
    }),
  ]);

  assert.equal(problems.length, 1);
});

test("guard allows true->true workspace edges", () => {
  const problems = findUnpublishableWorkspaceEdges([
    pkg("@bostan/server", {
      publishFromCi: true,
      dependencies: { "@bostan/shared": "workspace:*" },
    }),
    pkg("@bostan/shared", { publishFromCi: true }),
  ]);

  assert.deepEqual(problems, []);
});

test("guard ignores non-workspace specs, non-internal deps, and edges from off-train packages", () => {
  const problems = findUnpublishableWorkspaceEdges([
    pkg("@bostan/server", {
      publishFromCi: true,
      dependencies: {
        "@paperclipai/pinned": "0.3.1",
        zod: "^3.0.0",
      },
    }),
    pkg("@paperclipai/pinned", { publishFromCi: false }),
    pkg("@paperclipai/offtrain", {
      publishFromCi: false,
      dependencies: { "@paperclipai/also-off": "workspace:*" },
    }),
    pkg("@paperclipai/also-off", { publishFromCi: false }),
  ]);

  assert.deepEqual(problems, []);
});

test("the live release manifest has no unpublishable workspace edges", () => {
  assert.deepEqual(findUnpublishableWorkspaceEdges(buildReleasePackagePlan()), []);
});
