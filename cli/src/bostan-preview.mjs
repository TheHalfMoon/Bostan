#!/usr/bin/env node
/**
 * Bostan isolated local CLI preview.
 * No legacy runtime, updater, telemetry, database or service code is imported.
 */
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const args = process.argv.slice(2);

const HELP = `Bostan ${version} — development preview

Usage: bostan [--help | --version | status | install --local]

  --help, -h       Show this message
  --version, -V    Show Bostan preview CLI version
  status           Check isolated Bostan CLI installation (read-only)
  install --local  Install only this Bostan CLI preview into your user home

The local install places an isolated CLI shim in ~/.local/bin/bostan and
a verified payload in ~/.bostan/cli. It does not install or run the Bostan
server, agent runtimes, background services, model providers or updates.

Uninstall, update, upgrade, service, run, onboard and remote installs are
intentionally disabled. No external downloads or network requests occur.

Project: https://github.com/TheHalfMoon/Bostan
`;

async function main() {
  if (args.length === 0 || (args.length === 1 && ["--help", "-h"].includes(args[0]))) {
    process.stdout.write(HELP);
    return;
  }
  if (args.length === 1 && ["--version", "-V"].includes(args[0])) {
    process.stdout.write(`${version}\n`);
    return;
  }
  if (args.length === 1 && args[0] === "status") {
    const { statusLocal } = await import("./bostan-local-install.mjs");
    const status = statusLocal();
    process.stdout.write(status.installed
      ? `Bostan CLI preview ${status.version} installed at ${status.command}\n`
      : "Bostan CLI preview is not installed.\n");
    return;
  }
  if (args.length === 2 && args[0] === "install" && args[1] === "--local") {
    const { installLocal } = await import("./bostan-local-install.mjs");
    const status = installLocal();
    process.stdout.write(`Installed Bostan CLI preview ${status.version} at ${status.command}\n`);
    process.stdout.write("Server and agent operation remain disabled.\n");
    return;
  }
  const command = args[0]?.startsWith("-") ? "option" : "command";
  process.stderr.write(`Bostan: ${command} unavailable in this development preview. No operation was performed.\n`);
  process.exitCode = 2;
}

try {
  await main();
} catch (error) {
  process.stderr.write("Bostan: " + (error instanceof Error ? error.message : String(error)) + ". No operation was completed.\n");
  process.exitCode = 2;
}
