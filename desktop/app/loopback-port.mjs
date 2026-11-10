import net from "node:net";
import { randomInt } from "node:crypto";

// Some Windows hosts allocate low ephemeral ports (including Chromium's
// restricted port 6000). Keep HTTP application ports in the safe high range.
export async function selectLoopbackPort() {
  for (let attempt = 0; attempt < 32; attempt++) {
    const server = net.createServer();
    const port = randomInt(49152, 65001);
    try {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", resolve);
      });
    } catch (error) {
      // Windows Hyper-V/WSL exclusions report EACCES for reserved candidates.
      if (error.code === "EADDRINUSE" || error.code === "EACCES") continue;
      throw error;
    }
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    return port;
  }
  throw new Error("Bostan could not find an available local application port");
}
