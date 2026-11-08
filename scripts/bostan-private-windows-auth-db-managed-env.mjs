/**
 * Read-only, fail-closed admission for managed Cloud environment key names.
 * Never return, format, or inspect operator-supplied key names or values:
 * even an environment variable name may contain diagnostic control text.
 */
export const PRIVATE_WINDOWS_AUTH_DB_MANAGED_ENV_REFUSAL =
  'BOSTAN_WINDOWS_AUTH_DB_MANAGED_ENV_REFUSED';

export function inspectPrivateWindowsAuthDbManagedEnvironment(environment) {
  const denied = Object.freeze({
    allowed:false, marker:PRIVATE_WINDOWS_AUTH_DB_MANAGED_ENV_REFUSAL,
  });
  if (!environment || typeof environment !== 'object' || Array.isArray(environment))
    return denied;
  try {
    for (const name of Object.keys(environment)) {
      if (/^(?:PAPERCLIP_MANAGED_CONFIG|PAPERCLIP_PRIMARY_HOST)$/i.test(name) ||
          /^(?:PAPERCLIP_CLOUD_|BOSTAN_CLOUD_)/i.test(name))
        return denied;
    }
  } catch {
    return denied;
  }
  return Object.freeze({allowed:true,marker:null});
}
