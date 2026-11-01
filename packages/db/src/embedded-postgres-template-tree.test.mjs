import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isSelfContainedPostgresTemplateTree as safe } from "./embedded-postgres-template-tree.ts";

function own(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-b206-template-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const data = path.join(root, "cluster");
  fs.mkdirSync(data, { mode: 0o700 });
  fs.writeFileSync(path.join(data, "PG_VERSION"), "18\n");
  return { root, data };
}
test("accepts only an ordinary self-contained stopped template tree", t => {
  const { data } = own(t);
  fs.mkdirSync(path.join(data, "base", "1"), { recursive: true });
  fs.writeFileSync(path.join(data, "base", "1", "pg_filenode.map"), "fixture");
  fs.writeFileSync(path.join(data, "postgresql.conf"), "shared_buffers = 4MB\n");
  assert.equal(safe(data), true);
});
test("refuses a nested symbolic link to an external directory", t => {
  const { root, data } = own(t);
  const outside = path.join(root, "outside");
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "KEEP"), "foreign");
  fs.mkdirSync(path.join(data, "pg_tblspc"));
  fs.symlinkSync(outside, path.join(data, "pg_tblspc", "123"));
  assert.equal(safe(data), false);
  assert.equal(fs.readFileSync(path.join(outside, "KEEP"), "utf8"), "foreign");
});
test("refuses a nested dangling symlink", t => {
  const { root, data } = own(t);
  fs.symlinkSync(path.join(root, "not-created"), path.join(data, "postgresql.auto.conf"));
  assert.equal(safe(data), false);
});
test("refuses nested hardlinks shared with data outside the cluster", t => {
  const { root, data } = own(t);
  const external = path.join(root, "external-config");
  fs.writeFileSync(external, "shared_preload_libraries = ''");
  fs.linkSync(external, path.join(data, "postgresql.conf"));
  assert.equal(fs.statSync(external).nlink, 2);
  assert.equal(safe(data), false);
  assert.equal(fs.readFileSync(external, "utf8"), "shared_preload_libraries = ''");
});
test("allows ordinary nested directories and files", t => {
  const { data } = own(t);
  // A nested symlink is tested above; a directory remains valid in this control.
  fs.mkdirSync(path.join(data, "global"));
  assert.equal(safe(data), true);
});
test("refuses a tree exceeding the bounded maximum directory depth", t => {
  const { data } = own(t);
  let p = data;
  for (let i=0; i<35; i++) {
    p = path.join(p, "d");
    fs.mkdirSync(p);
  }
  assert.equal(safe(data), false);
});
test("rejects missing roots and symlinked root directories", t => {
  const { root, data } = own(t);
  assert.equal(safe(path.join(root,"absent")), false);
  const linked = path.join(root, "linked");
  fs.symlinkSync(data, linked, "dir");
  assert.equal(safe(linked), false);
});
