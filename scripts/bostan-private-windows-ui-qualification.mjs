#!/usr/bin/env node
/**
 * Real native Windows frontend verification, explicit opt-in and no publishing.
 * This never runs an installer, background agent or production server.
 */
import {readFileSync,statSync,statfsSync,readdirSync,realpathSync,existsSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {platform} from 'node:os';

const root=fileURLToPath(new URL('../',import.meta.url));
const readJSON=(p)=>JSON.parse(readFileSync(join(root,p),'utf8'));
const plan={schema:'bostan.private-windows-ui-qualification.v1',
  releaseQualified:false,explicitOptIn:true,requiresNativeWindows:true,
  runs:['@bostan/plugin-sdk build','@bostan/ui typecheck','@bostan/ui build'],runsAgents:false,
  optionalBrowser:'offline Playwright Chromium first paint (no server or database)',
  invokesProviders:false,publishes:false};
const args=process.argv.slice(2);
if(args.length===0||(args.length===1&&args[0]==='--plan')){
  console.log(JSON.stringify({...plan,run:false},null,2));
  process.exit(0);
}
if(args.length!==1||!['--run','--run-browser'].includes(args[0])){
  console.error('Usage: node scripts/bostan-private-windows-ui-qualification.mjs [--plan|--run|--run-browser]');
  process.exit(2);
}
const withBrowser=args[0]==='--run-browser';
if(platform()!=='win32'){
  console.error('Bostan native Windows UI gate refuses non-Windows hosts');
  process.exit(2);
}
const nodeParts=/^(\d+)\.(\d+)\.(\d+)$/.exec(process.versions.node)?.slice(1).map(Number);
if(!nodeParts||nodeParts.some(v=>!Number.isSafeInteger(v))||
   nodeParts[0]<24||(nodeParts[0]===24&&nodeParts[1]<11)){
  console.error('Bostan Windows UI gate requires Node >=24.11.0');
  process.exit(2);
}
const pkg=readJSON('package.json'),ui=readJSON('ui/package.json');
if(pkg.name!=='bostan'||pkg.private!==true||ui.name!=='@bostan/ui'||ui.private!==true){
  console.error('Bostan Windows UI gate refuses unexpected product manifests');
  process.exit(2);
}
for(const [name,spec] of [['prepack',ui.scripts.prepack],['prepublishOnly',ui.scripts.prepublishOnly]]){
  if(!spec?.includes('bostan-release-disabled.mjs')){
    console.error('Bostan UI registry quarantine missing: '+name);
    process.exit(2);
  }
}
const cloudKeys=Object.keys(process.env).filter(k=>k.toUpperCase()==='PAPERCLIP_MANAGED_CONFIG'||
  k.toUpperCase()==='PAPERCLIP_PRIMARY_HOST'||k.toUpperCase().startsWith('PAPERCLIP_CLOUD_')||
  k.toUpperCase().startsWith('BOSTAN_CLOUD_'));
if(cloudKeys.length){
  console.error('Bostan private Windows UI gate refuses Cloud environment keys: '+cloudKeys.sort().join(', '));
  process.exit(2);
}
const free=statfsSync(root,{bigint:true});
if(free.bavail*free.bsize<3n*1024n**3n){
  console.error('Bostan private Windows UI gate requires >=3 GiB free on checkout volume');
  process.exit(2);
}
const inherited={...process.env};
for(const key of Object.keys(inherited)){
  if(/^(OPENAI|ANTHROPIC|OPENROUTER|GEMINI|GOOGLE|XAI|SENTRY|OTEL_EXPORTER|AWS_|AZURE_)/i.test(key)||
    key.toUpperCase()==='NODE_OPTIONS')delete inherited[key];
}
Object.assign(inherited,{CI:'1',DO_NOT_TRACK:'1',OTEL_SDK_DISABLED:'true',
  npm_config_offline:'true',PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:'1'});
function run(command){
  const shell=process.env.ComSpec||'cmd.exe';
  console.log('BOSTAN_WIN_UI_COMMAND='+command);
  const result=spawnSync(shell,['/d','/c',command],{
    cwd:root,env:inherited,stdio:'inherit',windowsHide:true,timeout:300000,
  });
  if(result.error||result.status!==0){
    console.error('Bostan Windows UI gate failed:',command,
      result.error?.code??'exit '+String(result.status));
    process.exit(1);
  }
}
// The UI typechecks runner source and consumes the plugin SDK's compiled
// ./ui export. A UI-only install can leave both absent; refuse to misclassify
// those missing build inputs as product TypeScript defects.
for(const [pkgPath,expected] of [
  ['packages/paperclip-runner/node_modules/ajv/dist/2020.js','Runner AJV 2020'],
  ['packages/paperclip-runner/node_modules/json-schema-to-ts/package.json','Runner json-schema-to-ts'],
]){
  if(!existsSync(join(root,pkgPath))){
    console.error('Windows UI QA missing required build dependency: '+expected+
      '. Install --filter @bostan/ui... --filter @bostan/runner... with a frozen lockfile.');
    process.exit(2);
  }
}
if(withBrowser){
  // A version-mismatched cached Chromium must fail BEFORE rebuilding the
  // entire frontend. Probe the exact Playwright launch mode used by the smoke.
  let chromium;
  try {
    ({chromium}=createRequire(join(root,'ui','package.json'))('@playwright/test'));
  } catch {
    console.error('Bostan Windows browser gate requires installed UI Playwright dependencies');
    process.exit(2);
  }
  try {
    const browser=await chromium.launch({headless:true,timeout:15000,env:inherited});
    await browser.close();
  } catch {
    // Do not print browser paths or inherited user environment variables.
    console.error('Bostan Windows browser gate requires its pinned local Chromium headless shell. Install the matching Playwright browser into a private local cache.');
    process.exit(2);
  }
  console.log('BOSTAN_WINDOWS_OFFLINE_CHROMIUM_DEPENDENCY_ADMITTED');
}
run('pnpm --filter @bostan/plugin-sdk build');
console.log('BOSTAN_WINDOWS_PRIVATE_PLUGIN_SDK_BUILT');
run('pnpm --filter @bostan/ui typecheck');
console.log('BOSTAN_WINDOWS_PRIVATE_UI_TYPECHECK_PASS');
run('pnpm --filter @bostan/ui build');
console.log('BOSTAN_WINDOWS_PRIVATE_UI_BUILD_PASS');
const dist=join(root,'ui','dist'),actual=realpathSync(dist);
const uiRoot=realpathSync(join(root,'ui'));
if(!actual.startsWith(uiRoot+sep)||!statSync(dist).isDirectory())throw Error('UI output not owned by checkout');
const index=readFileSync(join(dist,'index.html'),'utf8');
if(!index.includes('Bostan'))throw Error('Built Bostan identity missing from HTML');
const assets=join(dist,'assets');
const names=readdirSync(assets);
if(!names.some(n=>n.endsWith('.js'))||!names.some(n=>n.endsWith('.css'))){
  throw Error('Built Bostan JS/CSS assets missing');
}
console.log(JSON.stringify({...plan,run:true,os:'win32',privateUI:true,
  htmlVerified:true,jsAssets:names.filter(n=>n.endsWith('.js')).length,
  cssAssets:names.filter(n=>n.endsWith('.css')).length,
  externalModelCalls:0},null,2));
console.log('BOSTAN_WINDOWS_PRIVATE_UI_ASSETS_VERIFIED');
if(withBrowser){
  // Playwright runs only against the local Vite production preview; the
  // existing smoke refuses external requests and never launches an agent.
  // Browser dependencies must be preinstalled; no download or provider call.
  run('pnpm --filter @bostan/ui exec node scripts/bostan-preview-browser-smoke.mjs');
  console.log('BOSTAN_WINDOWS_OFFLINE_CHROMIUM_FIRST_PAINT_PASS');
}
