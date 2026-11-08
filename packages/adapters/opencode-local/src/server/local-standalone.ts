import { isTruthyEnvFlag } from "./models.js";

/**
 * Bostan's isolated source-only runtime must not attach an agent to another
 * OpenCode process running under the user's account. Respect an explicit
 * --standalone, and never inject flags after the operator's -- terminator.
 */
export function bostanStandaloneArgs(
  extraArgs: string[],
  remote: boolean,
  env: Readonly<Record<string, string | undefined>> = process.env,
): string[] {
  const stop = extraArgs.indexOf("--");
  const options = stop < 0 ? extraArgs : extraArgs.slice(0, stop);
  if (remote || !isTruthyEnvFlag(env.BOSTAN_OPENCODE_STANDALONE) ||
    options.includes("--standalone")) return [];
  return ["--standalone"];
}
