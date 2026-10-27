import { describe, expect, it } from 'vitest';
import * as shim from './index.js';
import * as primary from '@bostan/adapter-hermes/gateway';
import * as shimServer from './server/index.js';
import * as primaryServer from '@bostan/adapter-hermes/gateway/server';
import * as shimUi from './ui/index.js';
import * as primaryUi from '@bostan/adapter-hermes/gateway/ui';
import * as shimCli from './cli/index.js';
import * as primaryCli from '@bostan/adapter-hermes/gateway/cli';

describe('Bostan Hermes Gateway deprecated package compatibility', () => {
  it('keeps public adapter identity and factories identical to the native unified adapter', () => {
    for (const name of ['agentConfigurationDoc', 'createServerAdapter', 'label', 'models', 'type'] as const) {
      expect(shim[name]).toBe(primary[name]);
    }
  });
  it('reexports exact gateway server API without divergence', () => {
    for (const name of ['execute', 'getConfigSchema', 'mapFinalResultForTest', 'parseSseFramesForTest', 'resolveSessionKey', 'sessionCodec', 'testEnvironment'] as const) {
      expect(shimServer[name]).toBe(primaryServer[name]);
    }
  });
  it('preserves UI and CLI behavior by exporting the same functions', () => {
    expect(shimUi.parseStdoutLine).toBe(primaryUi.parseStdoutLine);
    expect(shimCli.formatStdoutEvent).toBe(primaryCli.formatStdoutEvent);
  });
});
