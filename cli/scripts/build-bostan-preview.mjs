import { copyFileSync, chmodSync, mkdirSync } from "node:fs";

mkdirSync(new URL("../dist/", import.meta.url), { recursive: true });
const output = new URL("../dist/bostan.js", import.meta.url);
copyFileSync(new URL("../src/bostan-preview.mjs", import.meta.url), output);
copyFileSync(new URL("../src/bostan-local-install.mjs", import.meta.url), new URL("../dist/bostan-local-install.mjs", import.meta.url));
chmodSync(output, 0o755);
