import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";

/** pnpm deploy may recreate its destination. Own a separate, stable container
 * outside electron-builder's output tree and let deploy own only its child. */
export function createPackagingStage(parent = os.tmpdir()) {
  const canonicalParent = fs.realpathSync(parent);
  const container = fs.mkdtempSync(path.join(canonicalParent, "bostan-desktop-stage-"));
  const identity = fs.lstatSync(container);
  const ownerMarker = path.join(container, ".bostan-stage-owner");
  const ownerToken = randomBytes(32).toString("hex");
  fs.writeFileSync(ownerMarker, ownerToken, { flag: "wx", mode: 0o600 });
  return {
    directory: path.join(container, "runtime"),
    dispose() {
      const stat = fs.lstatSync(container);
      let markerMatches = false;
      try {
        const markerStat = fs.lstatSync(ownerMarker);
        markerMatches = markerStat.isFile() && !markerStat.isSymbolicLink()
          && fs.readFileSync(ownerMarker, "utf8") === ownerToken;
      } catch { /* Missing or unreadable ownership marker means we retain the stage. */ }
      if (path.dirname(container) !== canonicalParent || fs.realpathSync(container) !== container
          || !stat.isDirectory() || stat.isSymbolicLink()
          || stat.dev !== identity.dev || (identity.ino !== 0 && stat.ino !== identity.ino)
          || !markerMatches) {
        throw new Error("Bostan stage identity changed; temporary payload retained");
      }
      fs.rmSync(container, { recursive: true, force: false });
    },
  };
}
