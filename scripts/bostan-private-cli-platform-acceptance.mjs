#!/usr/bin/env node
/** Explicit, private Bostan CLI acceptance; no publish, deploy or provider calls. */
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const cliCases=[
  'cli/src/__tests__/bostan-preview.test.mjs',
  'cli/src/__tests__/bostan-local-install.test.mjs',
  'cli/src/__tests__/bostan-company-export-inspect.test.mjs',
];
const blockedKeys=[
  'OPENAI_API_KEY','ANTHROPIC_API_KEY','OPENROUTER_API_KEY',
  'GEMINI_API_KEY','GOOGLE_API_KEY','XAI_API_KEY',
  'AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','SENTRY_DSN',
  'DATABASE_URL','OTEL_EXPORTER_OTLP_ENDPOINT',
];

export function qualifyNodeVersion(version) {
  const match=/^(\d+)\.(\d+)\.(\d+)$/.exec(version||'');
  if(!match||Number(match[1])<24||(Number(match[1])===24&&(Number(match[2])<11))) {
    throw Error('Bostan private CLI qualification requires Node.js >=24.11.0 with built-in TypeScript support; distro Node 22 is not qualified.');
  }
  return true;
}

export function verifyPrivateSource(repoRoot=root) {
  const manifest=JSON.parse(readFileSync(resolve(repoRoot,'package.json'),'utf8'));
  const cli=JSON.parse(readFileSync(resolve(repoRoot,'cli/package.json'),'utf8'));
  if(manifest.name!=='bostan'||manifest.private!==true||cli.name!=='bostan'||cli.bin?.bostan!=='./dist/bostan.js')
    throw Error('Refusing to qualify a non-private or mismatched Bostan source tree');
  return true;
}

export function acceptancePlan() {
  return {schema:'bostan.private-cli-platform-acceptance.v1',qualified:false,
    releaseQualified:false,publicActionsEnabled:false,paidProvidersRequired:false,
    minimumNode:'24.11.0',platform:process.platform,
    mode:'explicit-local-qa',tests:cliCases};
}

function runChild(args,env) {
  const child=spawnSync(process.execPath,args,{
    cwd:root,env,stdio:'inherit',timeout:120000,windowsHide:true,
  });
  if(child.error)throw child.error;
  if(child.signal)throw Error('Private Bostan CLI acceptance terminated by '+child.signal);
  if(child.status!==0)throw Error('Private Bostan CLI acceptance failed (exit '+child.status+')');
}
export function runPrivateAcceptance() {
  qualifyNodeVersion(process.versions.node);
  if(!['win32','darwin','linux'].includes(process.platform))throw Error('Unsupported platform');
  verifyPrivateSource();
  const env={...process.env,npm_config_offline:'true',DO_NOT_TRACK:'1',
    OTEL_SDK_DISABLED:'true',BOSTAN_FEEDBACK_EXPORT_ENABLED:'0',CI:'1'};
  for(const key of blockedKeys)delete env[key];
  delete env.NODE_OPTIONS;
  runChild(['cli/scripts/build-bostan-preview.mjs'],env);
  runChild(['--test',...cliCases],env);
  process.stdout.write('BOSTAN_PRIVATE_CLI_PLATFORM_ACCEPTANCE_PASS\n');
}

const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
  const args=process.argv.slice(2);
  if(!args.length||(args.length===1&&['--plan','--help'].includes(args[0]))) {
    process.stdout.write(JSON.stringify(acceptancePlan(),null,2)+'\n');
  }else if(args.length===1&&args[0]==='--run'){
    try{runPrivateAcceptance()}catch(error){
      console.error('Bostan private CLI acceptance failed:',error.message);
      process.exitCode=1;
    }
  }else{
    console.error('Usage: node scripts/bostan-private-cli-platform-acceptance.mjs [--plan|--run]');
    process.exitCode=2;
  }
}
