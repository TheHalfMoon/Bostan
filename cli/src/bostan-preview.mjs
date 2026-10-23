#!/usr/bin/env node
/**
 * Bostan preview CLI: fail closed until a separately qualified Bostan
 * installer, state root, service manager and update flow exist.
 *
 * This is deliberately independent of the legacy CLI entrypoint: importing
 * that entrypoint initializes old install, updater, config and telemetry code.
 */
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const args = process.argv.slice(2);

const HELP = `Bostan ${version} — development preview

Usage: bostan [--help | --version]

  --help, -h       Show this message
  --version, -V    Show the Bostan source package version

Operational commands are disabled until the Bostan-native installer,
config/state location, service manager and update policies pass qualification.
No automatic downloads, installs, updates, server launches or external
connections are performed by this preview command.

Project: https://github.com/TheHalfMoon/Bostan
`;

if (args.length === 0 || (args.length === 1 && (args[0] === "--help" || args[0] === "-h"))) {
  process.stdout.write(HELP);
} else if (args.length === 1 && (args[0] === "--version" || args[0] === "-V")) {
  process.stdout.write(`${version}
`);
} else {
  const command = args[0]?.startsWith("-") ? "option" : "command";
  process.stderr.write(`Bostan: ${command} unavailable in this development preview. No operation was performed.
`);
  process.exitCode = 2;
}
