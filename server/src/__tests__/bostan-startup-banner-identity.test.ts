import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { printStartupBanner } from '../startup-banner.js';

describe('Bostan startup banner after native CLI rebranding', () => {
  const tempHomes: string[] = [];
  afterEach(() => {
    vi.restoreAllMocks();vi.unstubAllEnvs();
    for (const home of tempHomes.splice(0)) rmSync(home,{recursive:true,force:true});
  });
  it('prints the Bostan wordmark and actionable no-publish JWT guidance, never donor instructions', () => {
    const home = mkdtempSync(join(tmpdir(),'bostan-banner-'));
    tempHomes.push(home);
    vi.stubEnv('PAPERCLIP_HOME',home);
    vi.stubEnv('PAPERCLIP_AGENT_JWT_SECRET','');
    const output = vi.spyOn(console,'log').mockImplementation(()=>{});
    printStartupBanner({
      bind:'loopback',host:'127.0.0.1',deploymentMode:'local_trusted',
      deploymentExposure:'private',authReady:true,requestedPort:3195,listenPort:3195,
      uiMode:'static',db:{mode:'external-postgres',connectionString:'postgres://bostan_verify:secret@127.0.0.1:5432/bostan_qualification'},
      migrationSummary:'already applied',heartbeatSchedulerEnabled:false,heartbeatSchedulerIntervalMs:30000,
      databaseBackupEnabled:false,databaseBackupIntervalMinutes:60,databaseBackupRetentionDays:7,
      databaseBackupDir:join(home,'backups'),
    });
    const rendered = String(output.mock.calls[0]?.[0]??'').replace(/\x1b\[[0-9;]*m/g,'');
    expect(rendered).toMatch(/\nbostan\n/);
    expect(rendered).toContain('configure Bostan agent JWT for this instance');
    expect(rendered).not.toMatch(/paperclipai|npx .*onboard/i);
    expect(rendered).not.toContain('secret@');
    expect(rendered).toContain('bostan_verify:***@127.0.0.1');
  });
});
