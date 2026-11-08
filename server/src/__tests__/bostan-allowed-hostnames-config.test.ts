import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../config.js';
describe('Bostan host-allowlist configuration', () => {
  afterEach(()=>vi.unstubAllEnvs());
  it('supports the native BOSTAN_ALLOWED_HOSTNAMES setting',()=>{
    vi.stubEnv('BOSTAN_ALLOWED_HOSTNAMES','bostan.local, example.internal, bostan.local');
    vi.stubEnv('PAPERCLIP_ALLOWED_HOSTNAMES','legacy.internal');
    const hosts=loadConfig().allowedHostnames;
    expect(hosts).toContain('bostan.local');
    expect(hosts).toContain('example.internal');
    expect(hosts).not.toContain('legacy.internal');
    expect(hosts.filter(h=>h==='bostan.local')).toHaveLength(1);
  });
  it('preserves inherited env compatibility if the Bostan native setting is absent',()=>{
    vi.stubEnv('BOSTAN_ALLOWED_HOSTNAMES',undefined);
    vi.stubEnv('PAPERCLIP_ALLOWED_HOSTNAMES','legacy.internal');
    expect(loadConfig().allowedHostnames).toContain('legacy.internal');
  });
});
