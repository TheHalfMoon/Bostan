import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {inspectStaticImportGraph,staticSpecifiers} from "./bostan-server-import-graph.mjs";

function fixture(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"bostan-graph-"));
  const put=(name,body)=>{
    const target=path.join(root,name);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,body);
    return target;
  };
  try{return fn(root,put);}
  finally{fs.rmSync(root,{recursive:true,force:true});}
}
test("parses multiline, side-effect and reexport imports without dynamic or type-only imports",()=>{
  const code=[
    'import {',
    '   x',
    '} from "./first.js";',
    'import "./second.js";',
    'export * from "./third.js";',
    'export {name} from "./fourth.js";',
    'import type {A} from "./types.js";',
    'const x=import("./dynamic.js");',
    '// import "./comment.js";',
  ].join("\n");
  assert.deepEqual(staticSpecifiers(code),[
    "./first.js","./second.js","./third.js","./fourth.js",
  ]);
});
test("traverses local source edges, deduplicates cycles and excludes external libraries",()=>{
  fixture((root,put)=>{
    const entry=put("index.ts",[
      'import "./a.js";',
      'import "./b.js";',
      'import {z} from "remote-pkg";',
    ].join("\n"));
    put("a.ts",'import "./common.js";\nexport const a=1;');
    put("b.ts",'import "./common.js";\nexport const b=1;');
    put("common.ts",'import "./a.js";\nexport const z=1;');
    const result=inspectStaticImportGraph(root,entry);
    assert.equal(result.schema,"bostan.server-static-import-graph.v1");
    assert.equal(result.runtimeDurationMeasured,false);
    assert.equal(result.externalPackagesExpanded,false);
    assert.equal(result.sourceFilesScanned,4);
    assert.equal(result.directLocalImports,2);
    assert.equal(result.transitiveLocalModules,4);
    assert.equal(result.uniqueBareSpecifiers,1);
    assert.deepEqual(result.topStaticBranches.map(x=>[x.module,x.reachableLocalModules]),
      [["b.ts",3],["a.ts",2]]);
  });
});
test("refuses entries outside the inspected root",()=>{
  fixture((root,put)=>{
    const entry=put("index.ts","export const ok=1;");
    const child=path.join(root,"nested");
    fs.mkdirSync(child);
    assert.throws(()=>inspectStaticImportGraph(child,entry),/inside source root/);
  });
});
test("CLI is inert by default and refuses unknown commands",()=>{
  const script=fileURLToPath(new URL("./bostan-server-import-graph.mjs",import.meta.url));
  for(const args of [[],["--publish"],["--run"],["--inspect","--write"]]){
    const result=spawnSync(process.execPath,[script,...args],{encoding:"utf8"});
    assert.equal(result.status,2);
    assert.match(result.stderr,/read-only/);
  }
});
