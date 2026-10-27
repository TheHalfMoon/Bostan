#!/usr/bin/env node
/** Inspect isolated Bostan production deployment. No network or user installation. */
import {existsSync,lstatSync,readFileSync,readdirSync,realpathSync,renameSync,symlinkSync,unlinkSync} from 'node:fs';
import {dirname,join,relative,resolve,sep,isAbsolute,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
const fromFile=fileURLToPath(import.meta.url);
// Never trust TMPDIR for destructive staging cleanup: it may refer to HOME,
// a shared workspace or a mounted volume. Only system temporary roots qualify.
export function portableStagingRoot(platform=process.platform){
  if(platform==='darwin')return '/private/tmp';
  if(platform==='linux')return '/tmp';
  throw Error('Bostan private staging supports macOS/Linux only');
}
export function verifiedStagingRoot(platform=process.platform){
  const standard=portableStagingRoot(platform);
  const stat=lstatSync(standard);
  if(!stat.isDirectory())throw Error('System staging root is not a directory');
  return realpathSync(standard);
}
const relInside=(root,path)=>{const rel=relative(root,path);return rel==='' || (rel!=='..' && !rel.startsWith('..'+sep) && !isAbsolute(rel));};
const required=[
  'dist/index.js', 'dist/build-info.json', 'dist/vendor/paperclip-runner/index.js',
  'node_modules/@bostan/db/dist/index.js',
  'node_modules/@bostan/db/dist/migrate.js',
  'node_modules/@bostan/db/dist/migrations/meta/_journal.json',
  'node_modules/@bostan/shared/dist/index.js',
  'node_modules/@bostan/adapter-codex-local/dist/server/index.js',
  'node_modules/@bostan/adapter-codex-local/dist/server/codex-auth-merge-extract.sh',
  'node_modules/@bostan/plugin-sdk/dist/index.js',
  // ACP bridge's required SDK peer must ship in the *production* stage, not
  // only in the developer pnpm store. This never initializes any provider.
  'node_modules/@anthropic-ai/sdk/package.json',
  'node_modules/@bostan/skills-catalog/dist/src/index.js',
];
function ownedStage(stage){
  if(!stage || !isAbsolute(stage))throw Error('Use an absolute stage directory');
  const entry=lstatSync(stage);
  if(!entry.isDirectory() || entry.isSymbolicLink())throw Error('Stage must be a real directory');
  const root=realpathSync(stage);
  if(typeof process.getuid==='function' && entry.uid!==process.getuid())throw Error('Stage must be owned by current user');
  const manifest=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
  if(manifest.name!=='@bostan/server' || manifest.private!==true || manifest.scripts?.start!=='node --conditions=bostan-compiled dist/index.js')throw Error('Not a private compiled Bostan server stage');
  return root;
}
export function inspectLinks(root){
  const staged=realpathSync(root);
  let total=0;
  const queue=[staged];
  while(queue.length){
    const dir=queue.pop();
    for(const entry of readdirSync(dir,{withFileTypes:true})){
      const item=join(dir,entry.name);
      if(entry.isSymbolicLink()){
        total++;
        let target;
        try{target=realpathSync(item)}catch{throw Error(`Broken stage link: ${relative(staged,item)}`)}
        if(!relInside(staged,target))throw Error(`Stage link escapes private deployment: ${relative(staged,item)}`);
      }else if(entry.isDirectory())queue.push(item);
    }
  }
  return total;
}
export function verifyStage(stage){
  const root=ownedStage(stage);
  for(const filename of required){
    const path=join(root,filename);
    if(!existsSync(path)||!lstatSync(path).isFile())throw Error(`Missing staged Bostan runtime file: ${filename}`);
  }
  const sql=readdirSync(join(root,'node_modules/@bostan/db/dist/migrations')).filter(name=>name.endsWith('.sql'));
  if(sql.length<375)throw Error('Incomplete Bostan packaged SQL migration history');
  const links=inspectLinks(root);
  return {schema:'bostan.private-staged-server.v1',validated:true,releaseQualified:false,
    private:true,compiledRuntime:true,macStandaloneServerCandidate:true,
    sqlMigrationFiles:sql.length,internalLinks:links,foreignLinks:0,
    browserUIIncluded:existsSync(join(root,'ui-dist/index.html')),
    windowsQualified:false,linuxQualified:false,paidModelsUsed:false};
}
export function repairOwnedSelfLink(stage,source){
  const root=ownedStage(stage);
  const allowedRoots=[verifiedStagingRoot()];
  if(!basename(root).startsWith('bostan-staged-server-') || !allowedRoots.some(allowed=>relInside(allowed,root)&&root!==allowed))throw Error('Refusing link repair outside an owned disposable Bostan stage');
  if(!source||!isAbsolute(source))throw Error('Source checkout must be explicit and absolute');
  const checkout=realpathSync(source);
  const server=realpathSync(join(checkout,'server'));
  const old=join(root,'node_modules/.pnpm/node_modules/@bostan/server');
  if(!existsSync(dirname(old)))throw Error('No pnpm-managed self-link directory');
  const st=lstatSync(old);
  if(!st.isSymbolicLink())throw Error('Refusing to overwrite a non-symlink');
  const target=realpathSync(old);
  if(target===root)return {status:'already-internal'};
  if(target!==server)throw Error('Unexpected foreign symlink; refusing repair');
  const temp=old+'.bostan-owned-new';
  if(existsSync(temp))throw Error('Refusing to overwrite an existing file');
  try {
    symlinkSync(relative(dirname(old),root),temp,'dir');
    renameSync(temp,old);
  }finally{
    if(existsSync(temp))unlinkSync(temp);
  }
  if(realpathSync(old)!==root)throw Error('Failed to make pnpm self-link stage-contained');
  return {status:'repaired-only-generated-self-link'};
}
const direct=process.argv[1]&&resolve(process.argv[1])===fromFile;
if(direct){
  const args=process.argv.slice(2);
  if(args.length===0 || (args.length===1 && args[0]==='--plan')){
    console.log('Read-only Bostan stage validation: --verify <absolute-stage>; --stage-root displays the fixed OS system temp root; explicit owned self-link repair: --repair-owned-self-link <absolute-stage> --source-checkout <absolute-source>. No publish/install.');
  }else if(args.length===1 && args[0]==='--stage-root'){
    try{console.log(verifiedStagingRoot());}catch(error){console.error(`Bostan stage root refused: ${error.message}`);process.exitCode=2;}
  }else if(args.length===2&&args[0]==='--verify'){
    try{console.log(JSON.stringify(verifyStage(args[1]),null,2));}catch(error){console.error(`Bostan stage verification failed: ${error.message}`);process.exitCode=1;}
  }else if(args.length===4&&args[0]==='--repair-owned-self-link'&&args[2]==='--source-checkout'){
    try{console.log(JSON.stringify(repairOwnedSelfLink(args[1],args[3])));}catch(error){console.error(`Bostan stage repair refused: ${error.message}`);process.exitCode=1;}
  }else{console.error('Usage: --plan | --stage-root | --verify <absolute-stage> | --repair-owned-self-link <absolute-stage> --source-checkout <absolute-source>');process.exitCode=2;}
}
