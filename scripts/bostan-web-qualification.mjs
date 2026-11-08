#!/usr/bin/env node
// Source-only Bostan web verification. This intentionally excludes the native Rust gate,
// installed desktop/OS journeys, live database, production deployment, and paid providers.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('..',import.meta.url)));
const plan = [
  { name: 'Plugin SDK and shared contracts', args: ['--filter','@bostan/plugin-sdk','build'] },
  { name: 'Runner TypeScript surfaces only (no Rust)', args: ['--filter','@bostan/runner','build:typescript'] },
  { name: 'UI TypeScript and Storybook catalog', args: ['--filter','@bostan/ui','typecheck'] },
  { name: 'UI production Vite bundle', args: ['--filter','@bostan/ui','build'] },
  { name: 'Server source TypeScript (no native vendor rebuild)', args: ['--filter','@bostan/server','exec','tsc','--noEmit'] },
  { name: 'UI organization and onboarding contract regressions', args: ['--filter','@bostan/ui','exec','vitest','run','src/components/PluginOrganizationSwitcher.test.tsx','src/lib/agent-setup-fields.test.ts','src/lib/new-agent-hire-payload.test.ts','src/components/OnboardingWizard.adapters.test.tsx'] },
];

const mode = process.argv[2] ?? '--plan';
if (mode === '--plan' && process.argv.length <= 3) {
  process.stdout.write(JSON.stringify({kind:'bostan.web-source-preflight.v1',releaseQualified:false,steps:plan},null,2)+'\n');
} else if(mode === '--run' && process.argv.length <= 3) {
  const env = {...process.env};
  for (const key of ['OPENAI_API_KEY','ANTHROPIC_API_KEY','GEMINI_API_KEY','GOOGLE_API_KEY','XAI_API_KEY','OPENROUTER_API_KEY','KIMI_API_KEY','GROQ_API_KEY','DATABASE_URL']) delete env[key];
  for (const [index,step] of plan.entries()) {
    process.stdout.write(`[${index+1}/${plan.length}] ${step.name}\n`);
    const outcome=spawnSync('pnpm',step.args,{cwd:root,stdio:'inherit',env});
    if (outcome.error) { process.stderr.write(`${outcome.error.message}\n`);process.exit(1); }
    if (outcome.status!==0) process.exit(outcome.status??1);
  }
  process.stdout.write('Bostan web source checks passed. Full native/installed/DB/security/release gates remain OPEN; this is NOT release approval.\n');
} else {
  process.stderr.write('Usage: node scripts/bostan-web-qualification.mjs [--plan | --run]\n');
  process.exit(2);
}
