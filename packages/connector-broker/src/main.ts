#!/usr/bin/env node
import { FileAuditSink } from "./audit.js";
import { createBroker } from "./broker.js";
import { BrokerConfigError, loadBrokerConfig } from "./config.js";
import { createGoogleClient } from "./google.js";
import { createBrokerHttpServer } from "./http.js";
import { FileStore } from "./store.js";

function main() {
  let config;
  try {
    config = loadBrokerConfig();
  } catch (error) {
    process.stderr.write(`bostan-connector-broker: ${error instanceof BrokerConfigError ? error.message : "invalid configuration"}\n`);
    process.exit(2);
  }
  const summary = {
    publicOrigin: config.publicOrigin,
    environment: config.environment,
    listen: `${config.listenHost}:${config.listenPort}`,
    dataDir: config.dataDir,
    googleProfiles: config.google?.profiles ?? [],
    allowedInstanceOrigins: config.allowedInstanceOrigins ?? "any (operator approval required)",
    googleRedirectUri: `${config.publicOrigin}/oauth/google/callback`,
  };
  if (process.argv.includes("--doctor")) {
    process.stdout.write(`${JSON.stringify({ ok: true, ...summary }, null, 2)}\n`);
    return;
  }
  const broker = createBroker({
    config,
    store: new FileStore(config.dataDir),
    audit: new FileAuditSink(config.dataDir),
    google: config.google ? createGoogleClient(config.google) : null,
  });
  const server = createBrokerHttpServer({ publicOrigin: config.publicOrigin, trustProxy: config.trustProxy, handle: broker.handle });
  server.listen(config.listenPort, config.listenHost, () => {
    process.stdout.write(`bostan-connector-broker listening ${JSON.stringify(summary)}\n`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main();
