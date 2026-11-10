import assert from "node:assert/strict";
import net from "node:net";
import { test } from "node:test";
import { selectLoopbackPort } from "./loopback-port.mjs";

test("application port is browser-safe and its temporary listener is released", async () => {
  const port = await selectLoopbackPort();
  assert.ok(port >= 49152 && port <= 65000);
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
  await new Promise(resolve => server.close(resolve));
});
