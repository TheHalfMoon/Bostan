/**
 * Copy Bostan server runtime assets without Unix-only mkdir/cp shell commands.
 * The directory layout is identical to the historical build script.
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const DIRECTORIES=[
  ["server/src/onboarding-assets","server/dist/onboarding-assets"],
  ["server/src/built-ins","server/dist/built-ins"],
  ["server/src/services/scripts","server/dist/services/scripts"],
  ["packages/paperclip-runner/dist","server/dist/vendor/paperclip-runner"],
];
const RUNNER_SCRIPTS=[
  "install-copilot-assets.mjs",
  "materialize-copilot-binary.mjs",
  "copilot-inner-distribution.mjs",
];
function assertNoLinks(location){
  const st=fs.lstatSync(location,{throwIfNoEntry:false});
  if(!st)return;
  if(st.isSymbolicLink())throw Error("Refusing linked build input or output");
  if(st.isDirectory()){
    for(const entry of fs.readdirSync(location))
      assertNoLinks(path.join(location,entry));
  }else if(!st.isFile()){
    throw Error("Refusing non-file build input or output");
  }
}
// A previous build (or an image layer) can leave read-only outputs. Windows
// cannot overwrite those even with cpSync force, so restore owner write first.
// Destinations were already verified link-free by assertNoLinks.
function makeWritable(location){
  const st=fs.lstatSync(location,{throwIfNoEntry:false});
  if(!st)return;
  if(st.isDirectory()){
    for(const entry of fs.readdirSync(location))
      makeWritable(path.join(location,entry));
  }else if(st.isFile()&&(st.mode&0o200)===0){
    fs.chmodSync(location,st.mode|0o200);
  }
}
function owned(root,relative){
  const absolute=path.resolve(root,relative);
  const rel=path.relative(root,absolute);
  if(!rel||rel===".."||rel.startsWith(".."+path.sep)||path.isAbsolute(rel))
    throw Error("Build asset path outside owned repository");
  return absolute;
}
export function copyServerBuildAssets(repoRoot){
  const root=fs.realpathSync(repoRoot);
  const manifest=JSON.parse(fs.readFileSync(owned(root,"server/package.json"),"utf8"));
  if(manifest.name!=="@bostan/server")
    throw Error("Unexpected Bostan server package identity");
  const dirs=DIRECTORIES.map(([source,dest])=>[owned(root,source),owned(root,dest)]);
  const scripts=RUNNER_SCRIPTS.map(name=>[
    owned(root,"packages/paperclip-runner/scripts/"+name),
    owned(root,"server/dist/"+name),
  ]);
  const all=[...dirs,...scripts];
  // Preflight ALL inputs/outputs before copying anything.
  for(const [source,dest] of all){
    if(!fs.lstatSync(source,{throwIfNoEntry:false}))throw Error("Bostan build assets missing required input");
    assertNoLinks(source);
    let ancestor=dest;
    while(ancestor!==root){
      if(fs.lstatSync(ancestor,{throwIfNoEntry:false})?.isSymbolicLink())
        throw Error("Refusing symlinked build destination");
      ancestor=path.dirname(ancestor);
    }
    assertNoLinks(dest);
  }
  for(const [source,dest] of all){
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    makeWritable(dest);
    fs.cpSync(source,dest,{recursive:true,force:true,errorOnExist:false});
  }
  return {schema:"bostan.server-portable-build-assets.v1",
    directories:dirs.length,scripts:scripts.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==2)throw Error("No build asset command arguments supported");
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
  console.log(JSON.stringify(copyServerBuildAssets(root)));
}
