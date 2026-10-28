import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {copyServerBuildAssets} from "./copy-build-assets.mjs";

const folders=[
  "server/src/onboarding-assets",
  "server/src/built-ins",
  "server/src/services/scripts",
  "packages/paperclip-runner/dist",
];
const sourceScripts=[
  "install-copilot-assets.mjs",
  "materialize-copilot-binary.mjs",
  "copilot-inner-distribution.mjs",
];
function fixture(run){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"bostan-portable-server-assets-"));
  const put=(name,bytes)=>{
    const target=path.join(root,name);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,bytes);
    return target;
  };
  put("server/package.json",JSON.stringify({name:"@bostan/server",private:true}));
  for(const [index,dir] of folders.entries())put(dir+"/nested/sample.bin",Buffer.from([0,index,255,11]));
  for(const [index,name] of sourceScripts.entries())
    put("packages/paperclip-runner/scripts/"+name,Buffer.from([0,15,index]));
  try{return run(root,put);}
  finally{fs.rmSync(root,{recursive:true,force:true});}
}
test("copies original assets with exact file bytes and expected runtime layout",()=>{
  fixture((root)=>{
    const receipt=copyServerBuildAssets(root);
    assert.deepEqual(receipt,{schema:"bostan.server-portable-build-assets.v1",directories:4,scripts:3});
    for(const [index,destination] of [
      "server/dist/onboarding-assets",
      "server/dist/built-ins",
      "server/dist/services/scripts",
      "server/dist/vendor/paperclip-runner",
    ].entries()){
      assert.deepEqual(fs.readFileSync(path.join(root,destination,"nested/sample.bin")),
        Buffer.from([0,index,255,11]));
    }
    for(const [index,name] of sourceScripts.entries())
      assert.deepEqual(fs.readFileSync(path.join(root,"server/dist",name)),Buffer.from([0,15,index]));
    assert.deepEqual(copyServerBuildAssets(root),receipt);
  });
});
test("preserves unrelated compiled output in dist",()=>{
  fixture((root,put)=>{
    put("server/dist/index.js","compiled javascript survives");
    copyServerBuildAssets(root);
    assert.equal(fs.readFileSync(path.join(root,"server/dist/index.js"),"utf8"),
      "compiled javascript survives");
  });
});
test("missing required inputs fail before any copied output",()=>{
  fixture((root)=>{
    fs.rmSync(path.join(root,"packages/paperclip-runner/dist"),{recursive:true});
    assert.throws(()=>copyServerBuildAssets(root),/missing required input/);
    assert.equal(fs.existsSync(path.join(root,"server/dist/onboarding-assets")),false);
  });
});
test("foreign manifests cannot qualify",()=>{
  fixture((root,put)=>{
    put("server/package.json",JSON.stringify({name:"foreign",private:true}));
    assert.throws(()=>copyServerBuildAssets(root),/Unexpected Bostan server/);
    assert.equal(fs.existsSync(path.join(root,"server/dist")),false);
  });
});
test("refuses symbolic input and output escapes",()=>{
  fixture((root,put)=>{
    const outside=fs.mkdtempSync(path.join(os.tmpdir(),"bostan-server-outside-"));
    try{
      put("server/dist/index.js","unrelated");
      const link=path.join(root,"server/src/onboarding-assets/link");
      try{fs.symlinkSync(outside,link,"dir");}
      catch(e){if(["EPERM","EACCES"].includes(e.code))return;throw e;}
      assert.throws(()=>copyServerBuildAssets(root),/linked build input or output/);
      assert.equal(fs.existsSync(path.join(root,"server/dist/onboarding-assets")),false);
    }finally{fs.rmSync(outside,{recursive:true,force:true});}
  });
});
test("build command calls portable asset copier with no shell cp or mkdir",()=>{
  const root=path.resolve(import.meta.dirname,"..");
  const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
  assert.match(pkg.scripts.build,/node scripts\/copy-build-assets\.mjs/);
  assert.match(pkg.scripts.build,/node dist\/install-copilot-assets\.mjs/);
  assert.match(pkg.scripts.build,/node scripts\/write-build-stamp\.mjs/);
  assert.doesNotMatch(pkg.scripts.build,/\b(?:mkdir|cp)\s+-/);
});

test("refuses dangling destination symlink before any copy",()=>{
  fixture((root)=>{
    const link=path.join(root,"server/dist/onboarding-assets");
    fs.mkdirSync(path.dirname(link),{recursive:true});
    try{fs.symlinkSync(path.join(root,"nonexistent-target"),link,"dir");}
    catch(e){if(["EPERM","EACCES"].includes(e.code))return;throw e;}
    assert.throws(()=>copyServerBuildAssets(root),/symlinked build destination/);
    assert.equal(fs.existsSync(path.join(root,"server/dist/built-ins")),false);
  });
});
