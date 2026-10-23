import { copyFileSync, chmodSync, mkdirSync } from "node:fs";

mkdirSync(new URL("../dist/", import.meta.url), { recursive: true });
const output = new URL("../dist/bostan.js", import.meta.url);
copyFileSync(new URL("../src/bostan-preview.mjs", import.meta.url), output);
chmodSync(output, 0o755);
