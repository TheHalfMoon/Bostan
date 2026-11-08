import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BostanLocalOcrBusyError, BostanLocalOcrInputError,
  decodeBostanOcrImage, validateBostanOcrImageGeometry,
  previewBostanLocalImageOcr } from "../services/bostan-local-ocr.js";

const png = readFileSync(fileURLToPath(new URL("./fixtures/bostan-ocr-synthetic.png", import.meta.url)));
const sample = { mimeType: "image/png", base64: png.toString("base64"), language: "eng" };
const arabicPng = readFileSync(new URL("./fixtures/bostan-ocr-synthetic-arabic.png", import.meta.url));
const jpeg = readFileSync(new URL("./fixtures/bostan-ocr-synthetic.jpg", import.meta.url));

describe("Bostan zero-cloud, untrusted image OCR preview", () => {
  it("admits true PNG IHDR and JPEG SOF dimensions without decoding pixels", () => {
    expect(validateBostanOcrImageGeometry(png, "image/png"))
      .toMatchObject({ width: 520, height: 92 });
    expect(validateBostanOcrImageGeometry(jpeg, "image/jpeg"))
      .toMatchObject({ width: 520, height: 92 });
    expect(decodeBostanOcrImage({
      mimeType: "image/jpeg", base64: jpeg.toString("base64"), language: "eng",
    }).equals(jpeg)).toBe(true);
  });
  it("rejects tiny compressed image headers that would demand huge decompressed memory", () => {
    for (const [width, height] of [[9000, 92], [5000, 5000], [0, 92], [520, 0]]) {
      const fake = Buffer.from(png);
      fake.writeUInt32BE(width, 16);
      fake.writeUInt32BE(height, 20);
      expect(() => decodeBostanOcrImage({
        ...sample, base64: fake.toString("base64"),
      })).toThrow(BostanLocalOcrInputError);
    }
    for (const [width, height] of [[9000, 92], [5000, 5000], [0, 92], [520, 0]]) {
      const fake = Buffer.from(jpeg);
      let sof = -1;
      for (let i = 0; i < fake.length - 9; i++) {
        if (fake[i] === 0xff && [0xc0, 0xc1, 0xc2, 0xc3].includes(fake[i + 1])) {
          sof = i; break;
        }
      }
      expect(sof).toBeGreaterThan(0);
      fake.writeUInt16BE(height, sof + 5);
      fake.writeUInt16BE(width, sof + 7);
      expect(() => decodeBostanOcrImage({
        mimeType: "image/jpeg", base64: fake.toString("base64"), language: "eng",
      })).toThrow(BostanLocalOcrInputError);
    }
  });
  it("rejects header-masquerading PNG/JPEG and malformed frame offsets", () => {
    const nonIhdr = Buffer.from(png);
    nonIhdr.write("JHDR", 12, "ascii");
    expect(() => validateBostanOcrImageGeometry(nonIhdr, "image/png"))
      .toThrow(BostanLocalOcrInputError);
    const missingSof = Buffer.from([0xff,0xd8,0xff,0xe0,0x00,0x02,0xff,0xda,0x00,0x02,0xff,0xd9]);
    expect(() => validateBostanOcrImageGeometry(missingSof, "image/jpeg"))
      .toThrow(BostanLocalOcrInputError);
  });
  it("validates an actual PNG by bounded canonical base64 and its header", () => {
    expect(decodeBostanOcrImage(sample).equals(png)).toBe(true);
  });
  it("refuses unsupported file types, oversized inputs, hidden base64 characters and mismatched signatures", () => {
    const invalid = [
      { mimeType: "application/pdf" },
      { mimeType: "image/svg+xml" },
      { mimeType: "image/jpeg" },
      { language: "osd" },
      { language: "eng;curl" },
      { base64: sample.base64.slice(0, -1) + "!" },
      { base64: " ".repeat(100) },
      { base64: Buffer.alloc(256 * 1024 + 1).toString("base64") },
      { base64: Buffer.from("not-a-real-image").toString("base64") },
      { base64: sample.base64 + "\n" },
    ];
    for (const update of invalid) {
      expect(() => decodeBostanOcrImage({ ...sample, ...update })).toThrow(BostanLocalOcrInputError);
    }
  });
  it("extracts real Arabic glyphs offline and removes all private temporary image files", async () => {
    if (process.platform !== "darwin") return;
    const before = readdirSync(os.tmpdir()).filter(name => name.startsWith("bostan-private-ocr-"));
    const result = await previewBostanLocalImageOcr({
      mimeType: "image/png", base64: arabicPng.toString("base64"), language: "ara",
    });
    expect(result.text).toContain("بستان");
    expect(result.text).toContain("عربية");
    expect(result).toMatchObject({ provenanceVerified: false,
      persistedAsDocument: false, executionAuthorized: false });
    const after = readdirSync(os.tmpdir()).filter(name => name.startsWith("bostan-private-ocr-"));
    expect(after.sort()).toEqual(before.sort());
  });
  it("bounds concurrent local OCR jobs and frees its slots on every exit", async () => {
    if (process.platform !== "darwin") return;
    const runs = await Promise.allSettled([
      previewBostanLocalImageOcr(sample),
      previewBostanLocalImageOcr(sample),
      previewBostanLocalImageOcr(sample),
    ]);
    expect(runs.filter(run => run.status === "fulfilled")).toHaveLength(2);
    expect(runs.filter(run => run.status === "rejected")).toHaveLength(1);
    const rejection = runs.find(run => run.status === "rejected");
    expect(rejection && rejection.status === "rejected" && rejection.reason)
      .toBeInstanceOf(BostanLocalOcrBusyError);
    expect((await previewBostanLocalImageOcr(sample)).text).toContain("BOSTAN");
  });
  it("really extracts synthetic text locally and never treats text as an authorized citation", async () => {
    if (process.platform !== "darwin") return;
    const result = await previewBostanLocalImageOcr(sample);
    expect(result.text).toContain("BOSTAN");
    expect(result.text).toContain("OCR");
    expect(result).toMatchObject({
      language: "eng", truncated: false,
      sourceContentIsUntrusted: true,
      provenanceVerified: false,
      factualRelevanceVerified: false,
      persistedAsDocument: false,
      decisionCommitAuthorized: false,
      executionAuthorized: false,
    });
  });
});
