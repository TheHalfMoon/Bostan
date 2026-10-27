export const MINIMUM_NODE_VERSION = "24.11.0";
export const NODE_VERSION_INSTALL_GUIDE_URL =
  "https://github.com/TheHalfMoon/Bostan";
const NODE_VERSION_WARNING_EMITTED = Symbol.for("@bostan/node-version-warning-emitted");

function parseVersion(version: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isSupportedNodeVersion(version: string): boolean {
  const current = parseVersion(version);
  const minimum = parseVersion(MINIMUM_NODE_VERSION);
  if (!current || !minimum) return false;

  for (let index = 0; index < current.length; index += 1) {
    if (current[index] > minimum[index]) return true;
    if (current[index] < minimum[index]) return false;
  }
  return true;
}

export function formatNodeVersionWarning(version: string): string | null {
  if (isSupportedNodeVersion(version)) return null;
  const currentVersion = version.trim() || "unknown";
  return [
    `[bostan] warning: Node.js ${currentVersion} is unsupported. Bostan requires Node.js ${MINIMUM_NODE_VERSION} or newer.`,
    `Running executable: ${process.execPath}`,
    "Upgrade Node.js with a trusted version manager, then verify Bostan in the private source checkout:",
    `  ${NODE_VERSION_INSTALL_GUIDE_URL}`,
    "Do not run the retired inherited public install.sh workflow.",
    "Restart Bostan after upgrading.",
    "For a background service, update its startup executable and PATH; installing a newer Node.js in your shell does not change the service runtime.",
  ].join("\n");
}

export function warnIfUnsupportedNodeVersion(
  version: string,
  warn: (message: string) => void,
): boolean {
  const warning = formatNodeVersionWarning(version);
  if (!warning) return false;

  const warningState = globalThis as unknown as Record<symbol, boolean | undefined>;
  if (warningState[NODE_VERSION_WARNING_EMITTED]) return false;

  warningState[NODE_VERSION_WARNING_EMITTED] = true;
  warn(warning);
  return true;
}
