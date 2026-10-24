#!/usr/bin/env node
/**
 * Bostan isolated local CLI preview.
 * No legacy runtime, updater, telemetry, database or service code is imported.
 */
import { readFileSync, existsSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const args = process.argv.slice(2);

const HELP = `Bostan ${version} — development preview

Usage: bostan [--help | --version | status | install --local]
       bostan app doctor
       bostan app run --local [--port 3100]

  --help, -h       Show this message
  --version, -V    Show Bostan preview CLI version
  status           Check isolated Bostan CLI installation (read-only)
  install --local  Install only this Bostan CLI preview into your user home
  app doctor       Read-only runtime prerequisites check (source checkout)
  app run --local  Run built UI, server and isolated PostgreSQL in foreground

The local install places an isolated CLI shim in ~/.local/bin/bostan and
a verified payload in ~/.bostan/cli. It does not install or run the Bostan
server, agent runtimes, background services, model providers or updates.

The app commands require a prepared source checkout and an installed system
PostgreSQL. All app traffic binds to loopback and its state uses ~/.bostan/app.
App run can communicate with model providers only when explicitly configured.

Uninstall, update, upgrade, service, bare run, onboard and remote installs
remain disabled. No external downloads are performed by the CLI installer.

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
  if (args.length >= 2 && args[0] === "app"
    && (args[1] === "doctor" || args[1] === "run")) {
    const sourceModule = new URL("../../scripts/bostan-local-runtime.mjs", import.meta.url);
    if (!existsSync(sourceModule)) {
      throw new Error("App runtime commands require the full Bostan source checkout");
    }
    const { inspectLocalRuntime, runLocalRuntime } = await import(sourceModule.href);
    if (args.length === 2 && args[1] === "doctor") {
      const result = inspectLocalRuntime();
      process.stdout.write(result.ready
        ? "Bostan source runtime prerequisites satisfied.\n"
        : "Bostan source runtime missing: " + result.missing.join(", ") + "\n");
      if (!result.ready) process.exitCode = 2;
      return;
    }
    if (args[1] === "run" && args[2] === "--local") {
      if (!(args.length === 3 || (args.length === 5 && args[3] === "--port"))) {
        throw new Error("Use: bostan app run --local [--port <1024-65535>]");
      }
      const port = args.length === 5 ? Number(args[4]) : 3100;
      if (!Number.isInteger(port) || port < 1024 || port > 65535) {
        throw new Error("Invalid localhost app port");
      }
      await runLocalRuntime({ port });
      return;
    }
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
