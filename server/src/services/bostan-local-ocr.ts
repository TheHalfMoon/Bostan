import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { realpathSync, existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const run = promisify(execFile);
const MAX_IMAGE_BYTES = 256 * 1024;
const MAX_TEXT_CHARS = 2_000;
const MAX_BASE64_CHARS = Math.ceil(MAX_IMAGE_BYTES / 3) * 4;
const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const SUPPORTED_MIME = ["image/png", "image/jpeg"] as const;
const SUPPORTED_LANG = ["eng", "ara", "eng+ara"] as const;

export class BostanLocalOcrInputError extends Error {}
export class BostanLocalOcrBusyError extends Error {}
let activeLocalOcr = 0;
const MAX_PARALLEL_OCR = 2;

/** Fail before allocating an OCR process or writing user bytes. */
export function decodeBostanOcrImage(input: {
  mimeType: string; base64: string; language: string;
}) {
  if (!SUPPORTED_MIME.includes(input.mimeType as typeof SUPPORTED_MIME[number]) ||
      !SUPPORTED_LANG.includes(input.language as typeof SUPPORTED_LANG[number]) ||
      typeof input.base64 !== "string" ||
      input.base64.length < 12 || input.base64.length > MAX_BASE64_CHARS ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.base64)) {
    throw new BostanLocalOcrInputError("Invalid bounded PNG/JPEG image or OCR language");
  }
  const bytes = Buffer.from(input.base64, "base64");
  if (bytes.length < 12 || bytes.length > MAX_IMAGE_BYTES ||
      bytes.toString("base64") !== input.base64 ||
      (input.mimeType === "image/png" && !bytes.subarray(0, 8).equals(PNG_MAGIC)) ||
      (input.mimeType === "image/jpeg" &&
        !(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff))) {
    throw new BostanLocalOcrInputError("Image data is not a correctly encoded bounded PNG/JPEG");
  }
  return bytes;
}

function localTesseract() {
  if (process.platform !== "darwin" && process.platform !== "linux") return null;
  for (const binary of ["/opt/homebrew/bin/tesseract", "/usr/local/bin/tesseract", "/usr/bin/tesseract"]) {
    if (!existsSync(binary)) continue;
    try { return realpathSync(binary); } catch { /* Continue to other installed trusted paths. */ }
  }
  return null;
}

/** Strictly local, read-only OCR preview: no document/decision write or remote API. */
export async function previewBostanLocalImageOcr(input: {
  mimeType: string; base64: string; language: string;
}) {
  const bytes = decodeBostanOcrImage(input);
  const binary = localTesseract();
  if (!binary) throw new Error("Bostan local Tesseract OCR is unavailable");
  if (activeLocalOcr >= MAX_PARALLEL_OCR) {
    throw new BostanLocalOcrBusyError("Bostan local OCR concurrency limit exceeded");
  }
  activeLocalOcr += 1;
  let home: string | null = null;
  try {
    home = await mkdtemp(path.join(os.tmpdir(), "bostan-private-ocr-"));
    const image = path.join(home, input.mimeType === "image/png" ? "input.png" : "input.jpg");
    await writeFile(image, bytes, { mode: 0o600, flag: "wx" });
    let stdout = "";
    try {
      ({ stdout } = await run(binary, [image, "stdout", "-l", input.language, "--psm", "6"], {
        cwd: home,
        encoding: "utf8", timeout: 15_000, maxBuffer: 64 * 1024,
        windowsHide: true,
      }));
    } catch {
      // Never include Tesseract stderr, source filename, image content or
      // extracted raw text in a potentially public error log.
      throw new Error("Bostan local OCR could not process this image");
    }
    const text = stdout.replace(/\r\n/g, "\n").trim();
    return {
      schema: "bostan.knowledge.ocr-preview.v1" as const,
      text: text.slice(0, MAX_TEXT_CHARS),
      truncated: text.length > MAX_TEXT_CHARS,
      language: input.language,
      sourceContentIsUntrusted: true as const,
      provenanceVerified: false as const,
      factualRelevanceVerified: false as const,
      decisionCommitAuthorized: false as const,
      persistedAsDocument: false as const,
      executionAuthorized: false as const,
    };
  } finally {
    try {
      if (home) await rm(home, { recursive: true, force: true });
    } finally {
      activeLocalOcr -= 1;
    }
  }
}
