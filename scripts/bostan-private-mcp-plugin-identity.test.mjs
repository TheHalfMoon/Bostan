import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));
const load = name => JSON.parse(readFileSync(resolve(repo, name, "package.json"), "utf8"));
const names = [
  ["packages/mcp-server", "@bostan/mcp-server", ["bostan-mcp-server"]],
  ["packages/kv-demo-mcp-server", "@bostan/kv-demo-mcp-server", ["bostan-kv-demo-mcp-server"]],
  ["packages/google-sheets-mcp-server", "@bostan/google-sheets-mcp-server",
    ["bostan-google-sheets-mcp-server", "bostan-google-sheets-mcp-http-server"]],
  ["packages/plugins/examples/plugin-file-browser-example", "@bostan/plugin-file-browser-example", []],
  ["packages/plugins/examples/plugin-kitchen-sink-example", "@bostan/plugin-kitchen-sink-example", []],
  ["packages/plugins/examples/plugin-orchestration-smoke-example", "@bostan/plugin-orchestration-smoke-example", []],
];

for (const [dir, name, expectedCommands] of names) {
  test("Bostan owns private package "+name+" and blocks both npm publish hooks", () => {
    const pkg = load(dir);
    assert.equal(pkg.name, name);
    assert.equal(pkg.private, true);
    assert.equal(pkg.publishConfig, undefined);
    assert.equal(pkg.scripts?.prepack, pkg.scripts?.prepublishOnly);
    const script = pkg.scripts?.prepack?.match(/^node (\S+)$/)?.[1];
    assert.ok(script, "Bostan prepack gate missing");
    const gatePath = resolve(repo, dir, script);
    assert.equal(gatePath, resolve(repo, "scripts/bostan-release-disabled.mjs"));
    assert.ok(existsSync(gatePath));
    assert.deepEqual(Object.keys(pkg.bin ?? {}).sort(), expectedCommands.slice().sort());
    if (pkg.repository) {
      assert.equal(pkg.repository.url, "https://github.com/TheHalfMoon/Bostan");
    }
  });
}
test("new MCP servers advertise Bostan product identity in their handshakes", () => {
  for (const [dir, name] of [
    ["packages/mcp-server", "bostan"],
    ["packages/kv-demo-mcp-server", "bostan-kv-demo"],
    ["packages/google-sheets-mcp-server", "bostan-google-sheets"],
  ]) {
    const source = readFileSync(resolve(repo, dir, "src/index.ts"), "utf8");
    assert.ok(source.includes('name: "' + name + '"'));
  }
});
test("Bostan Google Sheets MCP preset uses the renamed installed executable", () => {
  for (const file of ["server/src/services/tool-access.ts", "server/src/services/tool-gateway.ts"]) {
    const content = readFileSync(resolve(repo,file),"utf8");
    assert.match(content,/command: "bostan-google-sheets-mcp-server"/);
    assert.doesNotMatch(content,/command: "paperclip-google-sheets-mcp-server"/);
  }
});
test("Bostan private release inventory admits no inherited MCP publishing", () => {
  const manifest=JSON.parse(readFileSync(resolve(repo,"scripts/release-package-manifest.json"),"utf8"));
  for (const [,name] of names.slice(0,3)) {
    const entry=manifest.find(x=>x.name===name);
    assert.ok(entry,"missing disabled owned package "+name);
    assert.equal(entry.publishFromCi,false);
  }
});
