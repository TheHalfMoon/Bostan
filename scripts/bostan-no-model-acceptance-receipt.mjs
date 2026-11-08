#!/usr/bin/env node
/** Offline validator for the exact five-scenario no-model Bostan source acceptance transcript. */
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const stages = Object.freeze([
  ['persistence', []],
  ['onboarding', ['real-browser-new-company-onboarding']],
  ['inactiveAgentDraft', ['real-browser-first-agent-inactive-draft', 'real-browser-adapter-selected-still-paused']],
  ['coldRestore', ['real-postgres-cold-backup-verify-new-home-restore-restart']],
  ['taskInsightsPrivacy', ['real-browser-private-task-insights', 'real-browser-html-no-referrer', 'real-browser-route-scoped-issue-bundle']],
]);
const begin = 'Bostan private no-model acceptance: ';
const passed = 'BOSTAN_LOCAL_PERSISTENCE_E2E_PASS ';
const final = 'BOSTAN_NO_MODEL_ACCEPTANCE_PASS';
const needs = ['private-health','company-create','clean-stop','restart','persistence'];

export function verifyTranscript(source) {
  if (typeof source !== 'string' || source.length > 524288) throw new Error('Invalid or oversized Bostan transcript');
  const lines = source.split(/\r?\n/).filter(Boolean);
  const findings = [];
  let stage = -1;
  let complete = false;
  for (const line of lines) {
    if (line.startsWith(begin)) {
      if (complete) throw new Error('Scenario after batch completion');
      if (stage >= 0 && findings.length !== stage + 1) throw new Error('Missing result before next scenario');
      ++stage;
      if (stage >= stages.length || line !== begin + stages[stage][0]) throw new Error('Unexpected, repeated or out-of-order scenario');
    } else if (line.startsWith(passed)) {
      if (complete || stage < 0 || findings.length !== stage) throw new Error('Unexpected or duplicate scenario receipt');
      let data;
      try { data = JSON.parse(line.slice(passed.length)); }
      catch { throw new Error('Malformed machine-readable scenario receipt'); }
      if (data.qualified !== true || !['darwin','linux'].includes(data.platform)) throw new Error('Scenario did not qualify on macOS/Linux');
      const verified = String(data.verified || '').split(',');
      for (const key of [...needs,...stages[stage][1]]) {
        if (!verified.includes(key)) throw new Error(`Missing verified evidence: ${key}`);
      }
      if (stage > 0 && (data.browserPageErrors !== 0 || data.browserExternalRequestsBlocked !== 0)) throw new Error('Browser emitted exceptions or outbound requests');
      if (stage === 3 && (!data.coldRestoreEvidence?.restoredIntoNewHome || !Number.isInteger(data.coldRestoreEvidence?.verifiedFiles) || data.coldRestoreEvidence.verifiedFiles <= 0)) throw new Error('Cold restore is not proven');
      findings.push({scenario:stages[stage][0],platform:data.platform,verified, ...(stage === 3 ? {coldRestoreFiles:data.coldRestoreEvidence.verifiedFiles} : {})});
    } else if (line.startsWith(final)) {
      if (complete || findings.length !== stages.length || stage !== stages.length - 1) throw new Error('Premature or duplicate completion');
      complete = true;
    } else if (line.includes('Acceptance scenario ') && line.includes('failed or timed out')) {
      throw new Error('The run includes a failed scenario');
    }
  }
  if (!complete) throw new Error('Bostan acceptance did not complete');
  if (new Set(findings.map(row => row.platform)).size !== 1) throw new Error('Mixed host platforms in one acceptance run');
  return {schema:'bostan.no-model-acceptance-receipt.v1',releaseQualified:false,allFivePassed:true,
    platform:findings[0].platform,scenarios:findings.map(({scenario}) => scenario),
    coldRestoreFiles:findings[3].coldRestoreFiles,browserPageErrors:0,externalRequestsBlocked:0,
    nativeRustQualified:false,installedWindowsQualified:false,realModelQualified:false};
}

const direct = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) {
  if (process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === '--help')) {
    console.log('Bostan private receipt validation (read-only): node scripts/bostan-no-model-acceptance-receipt.mjs --check-log <local-transcript>');
  } else if (process.argv.length === 4 && process.argv[2] === '--check-log') {
    try {
      const file = resolve(process.argv[3]);
      if (!statSync(file).isFile() || statSync(file).size > 524288) throw new Error('Expected a small existing local transcript file');
      console.log(JSON.stringify(verifyTranscript(readFileSync(file, 'utf8')),null,2));
    } catch (e) {
      console.error('Bostan no-model receipt validation failed:',e.message);
      process.exitCode = 1;
    }
  } else {
    console.error('Usage: node scripts/bostan-no-model-acceptance-receipt.mjs [--help | --check-log <local-transcript>]');
    process.exitCode = 2;
  }
}
