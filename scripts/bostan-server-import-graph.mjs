#!/usr/bin/env node
/**
 * Read-only Bostan source-only static import graph audit. This is a conservative
 * lower bound: it excludes non-relative package imports, dynamic import(),
 * require(), loader hooks and runtime evaluation, so NOT a timing profiler.
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

export function staticSpecifiers(source){
  const found=[];
  const lines=source.split(/\r?\n/);
  let pending="";
  for(const line of lines){
    const starts=/^\s*import\s+(?!type\b|\()/.test(line) ||
      /^\s*export\s+(?:\*|\{)/.test(line);
    if(starts)pending=line;
    else if(pending)pending+=" "+line;
    if(!pending)continue;
    const match=pending.match(/\bfrom\s*["']([^"']+)["']/) ||
      pending.match(/^\s*import\s*["']([^"']+)["']/);
    if(match){found.push(match[1]);pending="";continue;}
    if(pending.includes(";")||pending.length>3000)pending="";
  }
  return found;
}
function allSources(directory){
  const files=[];
  for(const ent of fs.readdirSync(directory,{withFileTypes:true})){
    if(ent.name==="__tests__"||ent.name==="node_modules")continue;
    const full=path.join(directory,ent.name);
    if(ent.isDirectory())files.push(...allSources(full));
    else if(ent.isFile()&&/\.(?:ts|tsx|mjs|js)$/.test(ent.name)&&
      !ent.name.endsWith(".d.ts"))files.push(full);
  }
  return files;
}
function resolveLocal(file,specifier){
  if(!specifier.startsWith("."))return null;
  const base=path.resolve(path.dirname(file),specifier);
  const stripped=base.replace(/\.(?:js|mjs|cjs)$/,"");
  const candidates=[
    base,stripped+".ts",stripped+".tsx",stripped+".mjs",
    path.join(stripped,"index.ts"),path.join(stripped,"index.tsx"),
  ];
  return candidates.find(p=>fs.existsSync(p)&&fs.statSync(p).isFile())??null;
}
export function inspectStaticImportGraph(srcRoot,entry=path.join(srcRoot,"index.ts")){
  const root=fs.realpathSync(srcRoot);
  const entryReal=fs.realpathSync(entry);
  if(entryReal!==root&&!entryReal.startsWith(root+path.sep))
    throw Error("Import graph entry must remain inside source root");
  const graph=new Map(), bare=new Set();
  const sourceFiles=allSources(root);
  for(const file of sourceFiles){
    const imports=staticSpecifiers(fs.readFileSync(file,"utf8"));
    const resolved=[];
    for(const spec of imports){
      const absolute=resolveLocal(file,spec);
      if(absolute){
        if(absolute===root||absolute.startsWith(root+path.sep))resolved.push(absolute);
      }else if(!spec.startsWith("."))bare.add(spec);
    }
    graph.set(file,[...new Set(resolved)]);
  }
  const walk=start=>{
    const visited=new Set(),pending=[start];
    while(pending.length){
      const f=pending.pop();
      if(visited.has(f))continue;
      visited.add(f);
      for(const next of graph.get(f)??[])pending.push(next);
    }
    return visited;
  };
  const direct=graph.get(entryReal)??[];
  const reachable=walk(entryReal);
  const top=direct.map(file=>({
    module:path.relative(root,file).replaceAll(path.sep,"/"),
    reachableLocalModules:walk(file).size,
  })).sort((a,b)=>b.reachableLocalModules-a.reachableLocalModules||
    a.module.localeCompare(b.module)).slice(0,15);
  return {
    schema:"bostan.server-static-import-graph.v1",evidence:"source-only",
    runtimeDurationMeasured:false,externalPackagesExpanded:false,
    sourceFilesScanned:sourceFiles.length,
    directLocalImports:direct.length,
    transitiveLocalModules:reachable.size,
    uniqueBareSpecifiers:bare.size,
    topStaticBranches:top,
  };
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==3||process.argv[2]!=="--inspect"){
    console.error("Usage: node scripts/bostan-server-import-graph.mjs --inspect (read-only)");
    process.exit(2);
  }
  const source=fileURLToPath(new URL("../server/src",import.meta.url));
  console.log(JSON.stringify(inspectStaticImportGraph(source),null,2));
}
