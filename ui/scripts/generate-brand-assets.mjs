#!/usr/bin/env node
/**
 * Generates the Bostan identity v3 logo set from src/brand/geometry.json.
 *
 *   node ui/scripts/generate-brand-assets.mjs
 *
 * Writes:
 *   ui/src/assets/brand/*.svg              lockup, mark, wordmark, app icon, tray
 *   ui/src/assets/brand/png/*.png          app icon + tray rasters
 *   ui/src/assets/brand/bostan.ico         Windows app icon (16-256)
 *   ui/src/assets/brand/bostan.icns        macOS app icon (16-1024)
 *   ui/public/favicon*.{svg,png,ico}, apple-touch-icon.png, android-chrome-*.png
 *
 * Rasterising uses the Playwright Chromium already present in dev/CI
 * environments. It does not touch desktop/ or installer configuration: the
 * desktop packaging work can point at ui/src/assets/brand/ when it lands.
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(here, "..");
const geometry = JSON.parse(readFileSync(path.join(uiRoot, "src/brand/geometry.json"), "utf8"));
const outDir = path.join(uiRoot, "src/assets/brand");
const pngDir = path.join(outDir, "png");
const publicDir = path.join(uiRoot, "public");

const C = {
  red: "#D91F26",
  ink: "#111214",
  paper: "#FFFFFF",
  navy: "#17245A",
  darkNode: "#FF5A52",
};

const TONES = {
  // Ink strokes, red nodes. For light backgrounds.
  default: { stroke: C.ink, node: C.red, bg: null },
  // White on Bostan Red.
  reversed: { stroke: C.paper, node: C.paper, bg: C.red },
  // White strokes, #FF5A52 nodes on navy.
  dark: { stroke: C.paper, node: C.darkNode, bg: C.navy },
  // White strokes, red nodes, transparent: for dark UI surfaces / dark tray.
  light: { stroke: C.paper, node: C.red, bg: null },
};

const fmt = (n) => Number(n.toFixed(3)).toString();

function markBody({ small = false, size = 64, stroke, node }) {
  const g = small ? geometry.markSmall : geometry.mark;
  const sw = small
    ? geometry.markSmall.strokeWidthBySize[size <= 16 ? "16" : size <= 24 ? "24" : "32"]
    : geometry.mark.strokeWidth;
  const strokes = small ? g.strokes : [...g.strokes, geometry.mark.ground];
  return [
    `<g fill="none" stroke="${stroke}" stroke-width="${sw}">${strokes.map((d) => `<path d="${d}"/>`).join("")}</g>`,
    `<g fill="${node}">${g.nodes.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join("")}</g>`,
  ].join("");
}

function wordmarkBody({ stroke, node }) {
  const w = geometry.wordmark;
  return [
    `<g fill="none" stroke="${stroke}" stroke-width="${w.strokeWidth}" stroke-linejoin="round">`,
    w.strokes.map((d) => `<path d="${d}"/>`).join(""),
    w.circles.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join(""),
    `</g>`,
    `<g fill="${node}">${w.nodes.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join("")}</g>`,
  ].join("");
}

function svg(viewBox, body, { label = "Bostan", bg = null, bgRadius = 0 } = {}) {
  const [x, y, w, h] = viewBox.split(" ").map(Number);
  const rect = bg ? `<rect x="${x}" y="${y}" width="${w}" height="${h}"${bgRadius ? ` rx="${bgRadius}"` : ""} fill="${bg}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${label}">${rect}${body}</svg>\n`;
}

/** Padded variants put the artwork on a coloured field with breathing room. */
function markSvg(toneName, { small = false, size = 64, padded = false } = {}) {
  const tone = TONES[toneName];
  const body = markBody({ small, size, stroke: tone.stroke, node: tone.node });
  if (!tone.bg || !padded) return svg("0 0 64 64", body, {});
  return svg("-16 -16 96 96", body, { bg: tone.bg });
}

function wordmarkSvg(toneName, { padded = false } = {}) {
  const tone = TONES[toneName];
  const body = wordmarkBody(tone);
  if (!tone.bg || !padded) return svg(geometry.wordmark.viewBox, body);
  return svg("-48 -54 578 208", body, { bg: tone.bg });
}

/** Lockup: mark scaled to the wordmark height (112), 40 units of gap. */
function lockupSvg(toneName, { padded = false } = {}) {
  const tone = TONES[toneName];
  const scale = 112 / 64;
  const markX = 0;
  const wordX = 112 + 40;
  const body = [
    `<g transform="translate(${markX} -6) scale(${fmt(scale)})">${markBody({ stroke: tone.stroke, node: tone.node })}</g>`,
    `<g transform="translate(${wordX} 0)">${wordmarkBody(tone)}</g>`,
  ].join("");
  const width = wordX + geometry.wordmark.width;
  if (!tone.bg || !padded) return svg(`0 -6 ${width} 112`, body);
  return svg(`-56 -62 ${width + 112} 224`, body, { bg: tone.bg });
}

/**
 * App icon: white mark on a red rounded square (radius ~ 22.5% like the
 * canvas, 84px tile with 20px radius). Small sizes use the small drawing.
 */
function appIconSvg(size = 1024) {
  const small = size <= 32;
  const body = markBody({ small, size, stroke: C.paper, node: C.paper });
  // Tile spans 0..64; artwork scaled to ~69% and centred (58/84 on the canvas).
  const s = small ? 0.78 : 0.69;
  const off = fmt((64 - 64 * s) / 2);
  return svg("0 0 64 64", `<g transform="translate(${off} ${off}) scale(${s})">${body}</g>`, {
    bg: C.red,
    bgRadius: small ? 12 : 14.4,
  });
}

function trySvgWrite(file, contents) {
  writeFileSync(file, contents);
  return file;
}

mkdirSync(outDir, { recursive: true });
mkdirSync(pngDir, { recursive: true });

const svgFiles = {
  "bostan-lockup.svg": lockupSvg("default"),
  "bostan-lockup-light.svg": lockupSvg("light"),
  "bostan-lockup-reversed.svg": lockupSvg("reversed", { padded: true }),
  "bostan-lockup-dark.svg": lockupSvg("dark", { padded: true }),
  "bostan-mark.svg": markSvg("default"),
  "bostan-mark-light.svg": markSvg("light"),
  "bostan-mark-reversed.svg": markSvg("reversed", { padded: true }),
  "bostan-mark-dark.svg": markSvg("dark", { padded: true }),
  "bostan-mark-small.svg": markSvg("default", { small: true, size: 24 }),
  "bostan-wordmark.svg": wordmarkSvg("default"),
  "bostan-wordmark-light.svg": wordmarkSvg("light"),
  "bostan-wordmark-reversed.svg": wordmarkSvg("reversed", { padded: true }),
  "bostan-wordmark-dark.svg": wordmarkSvg("dark", { padded: true }),
  "bostan-app-icon.svg": appIconSvg(1024),
  "bostan-favicon.svg": appIconSvg(32),
  "bostan-tray-16.svg": markSvg("default", { small: true, size: 16 }),
  "bostan-tray-16-light.svg": markSvg("light", { small: true, size: 16 }),
  "bostan-tray-32.svg": markSvg("default", { small: true, size: 32 }),
  "bostan-tray-32-light.svg": markSvg("light", { small: true, size: 32 }),
};
for (const [name, contents] of Object.entries(svgFiles)) trySvgWrite(path.join(outDir, name), contents);
writeFileSync(path.join(publicDir, "favicon.svg"), appIconSvg(32));

// ── Rasterise ─────────────────────────────────────────────────────────────
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = await import("playwright"));
}
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function rasterize(svgText, size) {
  await page.setViewportSize({ width: size, height: size });
  const html = `<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style></head><body>${svgText}</body></html>`;
  await page.setContent(html);
  return page.locator("svg").screenshot({ omitBackground: true, type: "png" });
}

const appIconPng = {};
for (const size of [16, 24, 32, 48, 64, 128, 180, 192, 256, 512, 1024]) {
  appIconPng[size] = await rasterize(appIconSvg(size), size);
  writeFileSync(path.join(pngDir, `bostan-app-icon-${size}.png`), appIconPng[size]);
}
for (const [size, tone] of [[16, "default"], [32, "default"], [16, "light"], [32, "light"]]) {
  const suffix = tone === "light" ? "-light" : "";
  writeFileSync(
    path.join(pngDir, `bostan-tray-${size}${suffix}.png`),
    await rasterize(markSvg(tone, { small: true, size }), size),
  );
  // @2x for HiDPI trays: draw at the small size's stroke weights, render 2x.
  writeFileSync(
    path.join(pngDir, `bostan-tray-${size}${suffix}@2x.png`),
    await rasterize(markSvg(tone, { small: true, size }), size * 2),
  );
}
await browser.close();

// ── ICO (PNG-compressed entries, Vista+) ──────────────────────────────────
function ico(entries) {
  const header = Buffer.alloc(6 + 16 * entries.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = header.length;
  entries.forEach(({ size, data }, i) => {
    const o = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, o);
    header.writeUInt8(size >= 256 ? 0 : size, o + 1);
    header.writeUInt8(0, o + 2);
    header.writeUInt8(0, o + 3);
    header.writeUInt16LE(1, o + 4);
    header.writeUInt16LE(32, o + 6);
    header.writeUInt32LE(data.length, o + 8);
    header.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...entries.map((e) => e.data)]);
}

// ── ICNS (PNG entries) ────────────────────────────────────────────────────
function icns(entries) {
  const chunks = entries.map(({ type, data }) => {
    const head = Buffer.alloc(8);
    head.write(type, 0, "ascii");
    head.writeUInt32BE(data.length + 8, 4);
    return Buffer.concat([head, data]);
  });
  const body = Buffer.concat(chunks);
  const head = Buffer.alloc(8);
  head.write("icns", 0, "ascii");
  head.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([head, body]);
}

const appIco = ico([16, 24, 32, 48, 64, 256].map((size) => ({ size, data: appIconPng[size] })));
writeFileSync(path.join(outDir, "bostan.ico"), appIco);
writeFileSync(
  path.join(outDir, "bostan.icns"),
  icns([
    { type: "icp4", data: appIconPng[16] },
    { type: "icp5", data: appIconPng[32] },
    { type: "icp6", data: appIconPng[64] },
    { type: "ic07", data: appIconPng[128] },
    { type: "ic08", data: appIconPng[256] },
    { type: "ic09", data: appIconPng[512] },
    { type: "ic10", data: appIconPng[1024] },
    { type: "ic11", data: appIconPng[32] },
    { type: "ic12", data: appIconPng[64] },
    { type: "ic13", data: appIconPng[256] },
    { type: "ic14", data: appIconPng[512] },
  ]),
);

// ── Web favicons / PWA icons ──────────────────────────────────────────────
writeFileSync(path.join(publicDir, "favicon.ico"), ico([16, 32, 48].map((size) => ({ size, data: appIconPng[size] }))));
writeFileSync(path.join(publicDir, "favicon-16x16.png"), appIconPng[16]);
writeFileSync(path.join(publicDir, "favicon-32x32.png"), appIconPng[32]);
writeFileSync(path.join(publicDir, "apple-touch-icon.png"), appIconPng[180]);
writeFileSync(path.join(publicDir, "android-chrome-192x192.png"), appIconPng[192]);
writeFileSync(path.join(publicDir, "android-chrome-512x512.png"), appIconPng[512]);

console.log(`Wrote ${Object.keys(svgFiles).length} SVGs, app icon PNGs, tray PNGs, bostan.ico, bostan.icns and web favicons.`);
