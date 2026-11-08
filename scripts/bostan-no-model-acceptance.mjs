#!/usr/bin/env node
/**
 * Reproducible private Bostan source acceptance battery.
 * No paid/free remote model, inherited release pipeline, or user-data fixtures.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const runner = 'scripts/bostan-local-live-persistence-e2e.mjs';
const scenarios = Object.freeze({
  persistence: [],
  onboarding: ['BOSTAN_LIVE_LOCAL_BROWSER_E2E','BOSTAN_LIVE_LOCAL_BROWSER_ONBOARDING_E2E'],
  inactiveAgentDraft: ['BOSTAN_LIVE_LOCAL_BROWSER_E2E','BOSTAN_LIVE_LOCAL_BROWSER_ONBOARDING_E2E','BOSTAN_LIVE_LOCAL_BROWSER_AGENT_DRAFT_E2E','BOSTAN_LIVE_LOCAL_BROWSER_ADAPTER_SELECTION_E2E'],
  coldRestore: ['BOSTAN_LIVE_LOCAL_BROWSER_E2E','BOSTAN_LIVE_LOCAL_COLD_RESTORE_E2E'],
  taskInsightsPrivacy: ['BOSTAN_LIVE_LOCAL_BROWSER_E2E','BOSTAN_LIVE_LOCAL_BROWSER_INSIGHTS_E2E','BOSTAN_LIVE_LOCAL_BROWSER_LAZY_ISSUE_E2E','BOSTAN_LIVE_LOCAL_BROWSER_HTML_HEADERS_E2E'],
});
const blockedSecrets = [
  'OPENAI_API_KEY','ANTHROPIC_API_KEY','GEMINI_API_KEY','GOOGLE_API_KEY',
  'OPENROUTER_API_KEY','OPENROUTER_FREE_KEY','XAI_API_KEY','GROQ_API_KEY',
  'DATABASE_URL','DATABASE_MIGRATION_URL','SENTRY_DSN','OTEL_EXPORTER_OTLP_ENDPOINT',
];
const disabledE2eFlags = [
  'BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E','BOSTAN_LIVE_LOCAL_GOVERNED_CASE_E2E',
  'BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL','BOSTAN_E2E_TWO_AGENT_TEAM',
  'BOSTAN_E2E_REVIEW_FIRST_AGENT','BOSTAN_LIVE_LOCAL_BROWSER_OCR_E2E',
  'BOSTAN_LIVE_LOCAL_BROWSER_LARGE_OCR_E2E','BOSTAN_TEST_ONLY_NODE_EGRESS_PROFILE',
  'BOSTAN_E2E_OPENROUTER_ZERO_PRICE_VERIFIED',
  ...new Set(Object.values(scenarios).flat()),
];
function plan(){
  return {
    schema:'bostan.no-model-private-acceptance.v1',releaseQualified:false,
    requires:'built local Bostan source UI, server, Postgres CLI and installed Chromium',
    scenarios:Object.entries(scenarios).map(([name,flags])=>({name,flags,liveModels:false,disposableDatabase:true,privateBrowser:name!=='persistence'})),
    exclusions:['paid inference','real user data','Rust binary qualification','Windows installer qualification','release approval'],
  };
}
const [verb,caseName,...extra] = process.argv.slice(2);
if ((!verb || verb==='--plan') && !caseName && extra.length===0) {
  console.log(JSON.stringify(plan(),null,2));
} else if (verb==='--run' && caseName && extra.length===0 && (caseName==='all' || Object.hasOwn(scenarios,caseName))) {
  if (!['darwin','linux'].includes(process.platform)) {
    console.error('Bostan source acceptance uses separate Windows TEMP QA and refuses this platform.');
    process.exitCode=2;
  } else {
    for(const scenario of (caseName==='all' ? Object.keys(scenarios) : [caseName])) {
      const env={...process.env};
      for(const key of [...blockedSecrets,...disabledE2eFlags]) delete env[key];
      Object.assign(env, {
        BOSTAN_LIVE_LOCAL_QA_CONFIRM:'1',
        BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E:'0',
        BOSTAN_LIVE_LOCAL_GOVERNED_CASE_E2E:'0',
        BOSTAN_ANNOUNCEMENTS_ENABLED:'0',
        BOSTAN_FEEDBACK_EXPORT_ENABLED:'0',
        DO_NOT_TRACK:'1',OTEL_SDK_DISABLED:'true',
      });
      for(const flag of scenarios[scenario]) env[flag]='1';
      console.log(`Bostan private no-model acceptance: ${scenario}`);
      const execution=spawnSync(process.execPath,[runner],{
        cwd:ROOT,env,stdio:'inherit',timeout:330_000,
      });
      if (execution.error || execution.status!==0){
        console.error(`Acceptance scenario ${scenario} failed or timed out: ${execution.error?.message??execution.status}`);
        process.exitCode=execution.status || 1;break;
      }
    }
    if(!process.exitCode)console.log('BOSTAN_NO_MODEL_ACCEPTANCE_PASS — native Rust, installed Windows/Linux, and live-agent gates remain OPEN');
  }
} else {
  console.error('Usage: node scripts/bostan-no-model-acceptance.mjs [--plan | --run persistence|onboarding|inactiveAgentDraft|coldRestore|taskInsightsPrivacy|all]');
  process.exitCode=2;
}
