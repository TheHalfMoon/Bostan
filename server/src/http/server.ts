import { createServer, type RequestListener, type ServerOptions } from "node:http";
import { setupPluginApiWebSocketServer } from "../realtime/plugin-api-ws.js";
import { setupRunnerPrpWebSocketServer } from "../realtime/runner-prp-ws.js";
import { isPrivateUpgradeRequestAllowed } from "../middleware/private-hostname-guard.js";

/** Create the HTTP listener used by both production and custom launchers. */
export function createPaperclipHttpServer(
  listener: RequestListener,
  options: {
    apiUrl: string;
    httpOptions?: ServerOptions;
    privateHostAdmission?: { enabled: boolean; allowedHostnames: string[]; bindHost: string };
  },
) {
  const server = createServer(options.httpOptions ?? {}, listener);
  // Upgrade requests never enter the Express request listener. Install this
  // fail-closed private-mode admission before all WebSocket upgrade handlers.
  // All Bostan handlers honor paperclipWebSocketHandled; a denied socket is
  // destroyed without dispatching authentication or a WebSocket handshake.
  if (options.privateHostAdmission?.enabled) {
    server.on("upgrade", (request, socket) => {
      if (isPrivateUpgradeRequestAllowed(request, options.privateHostAdmission!)) return;
      (request as typeof request & { paperclipWebSocketHandled?: boolean }).paperclipWebSocketHandled = true;
      socket.destroy();
    });
  }
  // Native execution uses the listener even when a launcher has no browser
  // realtime connection. Register it before any run can be admitted.
  setupRunnerPrpWebSocketServer(server, { apiUrl: options.apiUrl });
  setupPluginApiWebSocketServer(server, listener);
  return server;
}
