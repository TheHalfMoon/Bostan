import { describe, expect, it } from 'vitest';
import { loadHostConfig } from './config.js';

const base = {
  BROKER_NODE_IDENTITY: 'bostan-dev.tailnet.example',
  BROKER_SERVICE_UID: '101',
  BROKER_SERVICE_GID: '102',
  BROKER_RUNTIME_UID: '103',
};

describe('Bostan Tailscale host paths', () => {
  it('defaults to private Bostan socket, registry and audit files', () => {
    const config = loadHostConfig(base);
    expect(config.socketPath).toBe('/run/bostan-tailscale-broker/broker.sock');
    expect(config.registryPath).toBe('/var/lib/bostan-tailscale-broker/registry.json');
    expect(config.auditPath).toBe('/var/log/bostan-tailscale-broker/audit.log');
    expect(config.nodeIdentity).toBe(base.BROKER_NODE_IDENTITY);
    expect(config.serviceUid).toBe(101);
    expect(config.serviceGid).toBe(102);
    expect(config.runtimeUid).toBe(103);
  });

  it('preserves explicitly configured legacy deployment paths until operator migration', () => {
    const config = loadHostConfig({
      ...base,
      BROKER_SOCKET_PATH: '/run/legacy-broker/broker.sock',
      BROKER_REGISTRY_PATH: '/var/lib/legacy-broker/registry.json',
      BROKER_AUDIT_PATH: '/var/log/legacy-broker/audit.log',
    });
    expect(config.socketPath).toBe('/run/legacy-broker/broker.sock');
    expect(config.registryPath).toBe('/var/lib/legacy-broker/registry.json');
    expect(config.auditPath).toBe('/var/log/legacy-broker/audit.log');
  });

  it('still fails closed on malformed ownership credentials', () => {
    expect(() => loadHostConfig({ ...base, BROKER_SERVICE_UID: 'not-a-number' })).toThrow(/BROKER_SERVICE_UID/);
  });
});
