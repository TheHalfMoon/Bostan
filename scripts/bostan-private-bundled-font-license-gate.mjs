#!/usr/bin/env node
/** Read-only integrity/NOTICE gate for first-party bundled Bostan font assets.
 * Does not certify all dependency licenses or perform any network/registry IO.
 */
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const inventoryPath='scripts/bostan-private-bundled-font-inventory.json';
const uiNotice='ui/public/fonts/NOTICE.md';
const capabilityNotice='packages/paperclip-runner/devtools/issue-thread/src/fonts/NOTICE.md';

function requireText(source,fragments,name) {
  for(const fragment of fragments)
    if(!source.includes(fragment))throw Error('Bostan legal source notice incomplete: '+name);
}
export function verifyBundledFontNotices({
  rootDir=root,
  readText=(relative)=>readFileSync(resolve(rootDir,relative),'utf8'),
  readBlob=(absolute)=>readFileSync(absolute),
}={}) {
  const list=JSON.parse(readText(inventoryPath));
  if(list?.schema!=='bostan.private-bundled-font-license.v1'
    ||!Array.isArray(list.assets)||list.assets.length!==8)
    throw Error('Bostan bundled font inventory missing or invalid');
  const ui=readText(uiNotice);
  const cap=readText(capabilityNotice);
  requireText(readText('LICENSE'),[
    'MIT License','Copyright (c) 2025 Paperclip AI',
    'The above copyright notice and this permission notice shall be included',
  ],'repository MIT');
  requireText(readText('packages/shared/src/cliplab/LICENSE'),[
    'MIT License','Jérémy Perret','Tonio',
  ],'ClipLab MIT');
  requireText(readText('packages/shared/src/cliplab/PROVENANCE.md'),[
    'https://github.com/tonio-alucema/cliplab','License: MIT',
  ],'ClipLab source provenance');
  requireText(ui,[
    'Bostan bundles Inter','SIL Open Font License 1.1','## Paper Mono',
    'PaperMono-OFL.txt','https://github.com/rsms/inter',
  ],'Bostan board fonts');
  requireText(readText('ui/public/fonts/PaperMono-OFL.txt'),[
    'SIL OPEN FONT LICENSE','Version 1.1',
  ],'Paper Mono redistribution license');
  requireText(cap,[
    '## Inter','## DejaVu Sans Mono','## Noto Sans Symbols 2',
    'Bitstream Vera Fonts license','Copyright (c) 2003 by Bitstream',
    'SIL Open Font License 1.1',
  ],'Bostan issue-thread fonts');
  requireText(readText('packages/plugins/examples/plugin-kitchen-sink-example/package.json'),[
    'full Bostan plugin surface area','"private": true',
  ],'Bostan plugin example identity');
  const seen=new Set();
  const directories=new Map();
  const noticeCounts=new Map();
  for(const item of list.assets){
    if(typeof item?.path!=='string'||!(/^(ui\/public\/fonts|packages\/paperclip-runner\/devtools\/issue-thread\/src\/fonts)\/[\w.-]+\.woff2$/).test(item.path)
      ||seen.has(item.path)||!/^[a-f0-9]{64}$/.test(item.sha256)
      ||!['OFL-1.1','Bitstream-Vera'].includes(item.license)
      ||![uiNotice,capabilityNotice].includes(item.notice))
      throw Error('Bostan bundled font record invalid or duplicated');
    if(item.path.startsWith('ui/')!== (item.notice===uiNotice))
      throw Error('Bostan bundled font NOTICE belongs to a different font directory');
    const p=resolve(rootDir,item.path);
    const stat=lstatSync(p);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)
      throw Error('Bundled Bostan font is not a regular standalone asset');
    const digest=createHash('sha256').update(readBlob(p)).digest('hex');
    if(digest!==item.sha256)throw Error('Bundled Bostan font digest has changed without notice review');
    seen.add(item.path);
    const dir=dirname(item.path);
    directories.set(dir,(directories.get(dir)||0)+1);
    noticeCounts.set(item.notice,(noticeCounts.get(item.notice)||0)+1);
  }
  for(const [dir,count] of directories){
    const actual=readdirSync(resolve(rootDir,dir)).filter(x=>x.endsWith('.woff2')).sort();
    const expected=list.assets.filter(item=>dirname(item.path)===dir).map(item=>item.path.slice(dir.length+1)).sort();
    if(count!==expected.length||JSON.stringify(actual)!==JSON.stringify(expected))
      throw Error('Unaccounted bundled Bostan font discovered without license inventory');
  }
  if(directories.size!==2||noticeCounts.size!==2||directories.get('ui/public/fonts')!==3||directories.get('packages/paperclip-runner/devtools/issue-thread/src/fonts')!==5)
    throw Error('Bostan bundled font directory and notice coverage incomplete');
  return {schema:list.schema,passed:true,releaseQualified:false,
    bundledFonts:seen.size,boardFonts:3,issueThreadFonts:5,
    noticesPreserved:2,sourceCopyrightPreserved:true,
    fullDependencyLicenseAuditComplete:false,paidProvidersUsed:false};
}
const entry=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(entry){
  const args=process.argv.slice(2);
  if(args.length===0||(args.length===1&&args[0]==='--plan'))
    console.log(JSON.stringify({schema:'bostan.private-bundled-font-license.v1',run:false,mutates:false,releaseQualified:false},null,2));
  else if(args.length===1&&args[0]==='--check'){
    try{console.log(JSON.stringify(verifyBundledFontNotices(),null,2))}
    catch(err){console.error('Bostan bundled font/NOTICE integrity gate failed:',err.message);process.exitCode=1}
  }else{
    console.error('Usage: node scripts/bostan-private-bundled-font-license-gate.mjs [--plan|--check]');
    process.exitCode=2;
  }
}
