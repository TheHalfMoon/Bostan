import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** pnpm deploy may recreate its destination. Own a separate, stable container
 * outside electron-builder's output tree and let deploy own only its child. */
export function createPackagingStage(parent = os.tmpdir()) {
  const canonicalParent = fs.realpathSync(parent);
  const container = fs.mkdtempSync(path.join(canonicalParent, "bostan-desktop-stage-"));
  const identity = fs.lstatSync(container);
  return {
    directory: path.join(container, "runtime"),
    dispose() {
      const stat = fs.lstatSync(container);
      if (path.dirname(container) !== canonicalParent || fs.realpathSync(container) !== container
          || !stat.isDirectory() || stat.isSymbolicLink()
          || stat.dev !== identity.dev || stat.ino !== identity.ino) {
        throw new Error("Bostan stage identity changed; temporary payload retained");
      }
      fs.rmSync(container, { recursive: true, force: false });
    },
  };
}
