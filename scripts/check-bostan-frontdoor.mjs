import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../ui/index.html", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../ui/public/site.webmanifest", import.meta.url), "utf8"));
const favicon = readFileSync(new URL("../ui/public/favicon.svg", import.meta.url), "utf8");
const server = readFileSync(new URL("../server/src/ui-branding.ts", import.meta.url), "utf8");

assert.match(html, /<title>Bostan<\/title>/);
assert.match(html, /apple-mobile-web-app-title" content="Bostan"/);
assert.match(html, /Bostan couldn.t start/);
assert.match(html, /href="\/favicon.svg"/);
assert.doesNotMatch(html, /(?:href|src)="\/(?:favicon\.ico|favicon-16x16\.png|favicon-32x32\.png|apple-touch-icon\.png)"/);
assert.equal(manifest.name, "Bostan");
assert.equal(manifest.short_name, "Bostan");
assert.ok(manifest.icons.length > 0);
assert.ok(manifest.icons.every((icon) => icon.src === "/favicon.svg"));
assert.match(favicon, /aria-label="Bostan"/);
assert.match(server, /DEFAULT_FAVICON_LINKS = '<link rel="icon" href="\/favicon.svg"/);
console.log("PASS: Bostan browser shell, fallback and PWA identity");
