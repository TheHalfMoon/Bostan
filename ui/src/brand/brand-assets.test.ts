import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import geometry from "./geometry.json";

const assetsDir = path.resolve(import.meta.dirname, "../assets/brand");
const publicDir = path.resolve(import.meta.dirname, "../../public");
const read = (file: string) => readFileSync(path.join(assetsDir, file), "utf8");
const RETIRED = ["#F6F4EB", "#D7E7DE", "#7F9EB7", "#18181b", "Newsreader", "<text"];

describe("Bostan v3 logo set", () => {
  const svgs = readdirSync(assetsDir).filter((file) => file.endsWith(".svg"));

  it("ships every required variant", () => {
    for (const file of [
      "bostan-lockup.svg",
      "bostan-lockup-reversed.svg",
      "bostan-lockup-dark.svg",
      "bostan-mark.svg",
      "bostan-mark-reversed.svg",
      "bostan-mark-dark.svg",
      "bostan-mark-small.svg",
      "bostan-wordmark.svg",
      "bostan-app-icon.svg",
      "bostan-favicon.svg",
      "bostan-tray-16.svg",
      "bostan-tray-32.svg",
      "bostan.ico",
      "bostan.icns",
      "png/bostan-app-icon-1024.png",
      "png/bostan-tray-16@2x.png",
    ]) {
      expect(existsSync(path.join(assetsDir, file)), file).toBe(true);
    }
  });

  it("draws every SVG from the shared geometry with no retired colours or live text", () => {
    for (const file of svgs) {
      const svg = read(file);
      expect(svg, file).toContain('aria-label="Bostan"');
      for (const retired of RETIRED) expect(svg.includes(retired), `${file}: ${retired}`).toBe(false);
    }
    for (const d of [...geometry.mark.strokes, geometry.mark.ground]) expect(read("bostan-mark.svg")).toContain(`d="${d}"`);
    for (const d of geometry.markSmall.strokes) expect(read("bostan-mark-small.svg")).toContain(`d="${d}"`);
    expect(read("bostan-mark-small.svg")).not.toContain(geometry.mark.ground);
    for (const d of geometry.wordmark.strokes) expect(read("bostan-wordmark.svg")).toContain(`d="${d}"`);
  });

  it("uses the approved colour treatments", () => {
    expect(read("bostan-mark.svg")).toMatch(/stroke="#111214"[\s\S]*fill="#D91F26"/);
    expect(read("bostan-mark-reversed.svg")).toContain('fill="#D91F26"');
    expect(read("bostan-mark-reversed.svg")).not.toContain('stroke="#111214"');
    expect(read("bostan-mark-dark.svg")).toMatch(/fill="#17245A"[\s\S]*fill="#FF5A52"/);
    expect(read("bostan-app-icon.svg")).toMatch(/rx="[\d.]+" fill="#D91F26"[\s\S]*stroke="#FFFFFF"/);
  });

  it("serves the app icon as the web favicon", () => {
    expect(readFileSync(path.join(publicDir, "favicon.svg"), "utf8")).toBe(read("bostan-favicon.svg"));
  });

  it("writes valid ICO and ICNS containers", () => {
    const ico = readFileSync(path.join(assetsDir, "bostan.ico"));
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(6);
    const icns = readFileSync(path.join(assetsDir, "bostan.icns"));
    expect(icns.subarray(0, 4).toString("ascii")).toBe("icns");
    expect(icns.readUInt32BE(4)).toBe(icns.length);
  });
});
