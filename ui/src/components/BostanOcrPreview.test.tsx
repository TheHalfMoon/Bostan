// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BostanOcrPreview } from "./BostanOcrPreview";
import { api } from "../api/client";

vi.mock("../api/client", () => ({ api: { post: vi.fn() } }));
type OcrMock = typeof api.post;
const mockPost = vi.mocked(api.post as OcrMock);

let root: Root;
let host: HTMLDivElement;
beforeEach(async () => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  mockPost.mockReset();
  await act(async () => {
    root.render(<BostanOcrPreview companyId="company-test" issueId="issue-test" />);
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});
async function open() {
  await act(async () => {
    (host.querySelector("button") as HTMLButtonElement).click();
  });
}
async function upload(file: File) {
  const input = host.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 25));
  });
}

it("is opt-in, reads the local image, shows only untrusted OCR text and never saves", async () => {
  mockPost.mockResolvedValue({
    text: "BOSTAN synthetic text", truncated: false,
    sourceContentIsUntrusted: true, provenanceVerified: false,
    factualRelevanceVerified: false, decisionCommitAuthorized: false,
    persistedAsDocument: false, executionAuthorized: false,
  } as never);
  expect(host.querySelector('input[type="file"]')).toBeNull();
  await open();
  expect(host.textContent).toContain("not saved");
  await upload(new File([new Uint8Array([137,80,78,71,13,10,26,10])], "sample.png", { type: "image/png" }));
  expect(mockPost).toHaveBeenCalledTimes(1);
  expect(mockPost.mock.calls[0]?.[0]).toBe("/companies/company-test/issues/issue-test/bostan-evidence/ocr-preview");
  expect(mockPost.mock.calls[0]?.[1]).toMatchObject({ mimeType: "image/png", language: "eng+ara" });
  expect(mockPost.mock.calls[0]?.[2]).toHaveProperty("signal");
  expect((host.querySelector('textarea[aria-label="Extracted OCR text"]') as HTMLTextAreaElement).value)
    .toBe("BOSTAN synthetic text");
  expect(host.textContent).not.toContain("Save OCR");
});
it("rejects oversized images client-side without sending any HTTP request", async () => {
  await open();
  await upload(new File([new Uint8Array(4 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }));
  expect(mockPost).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("4 MiB");
});
it("refuses an unsafe OCR response that falsely claims to be signed evidence", async () => {
  mockPost.mockResolvedValue({
    text: "untrusted", truncated: false, sourceContentIsUntrusted: true,
    provenanceVerified: true, factualRelevanceVerified: false,
    decisionCommitAuthorized: false, persistedAsDocument: false,
    executionAuthorized: false,
  } as never);
  await open();
  await upload(new File([new Uint8Array([137,80,78,71,13,10,26,10])], "sample.png", { type: "image/png" }));
  expect(host.querySelector("textarea")).toBeNull();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("unavailable");
});

it("converts a large synthetic PNG into bounded JPEG entirely in-browser", async () => {
  const close = vi.fn();
  const nativeBitmap = globalThis.createImageBitmap;
  Object.defineProperty(globalThis, "createImageBitmap", {
    configurable: true,
    value: vi.fn().mockResolvedValue({ width: 1200, height: 800, close }),
  });
  const context = { fillStyle: "", fillRect: vi.fn(), drawImage: vi.fn(),
    imageSmoothingEnabled: false, imageSmoothingQuality: "" };
  const draw = vi.spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation((cb) => cb(new Blob([
      new Uint8Array([255, 216, 255, 224, 12, 14, 16, 18]),
    ], { type: "image/jpeg" })));
  mockPost.mockResolvedValue({
    text: "BOSTAN recognized", truncated: false,
    sourceContentIsUntrusted: true, provenanceVerified: false,
    factualRelevanceVerified: false, decisionCommitAuthorized: false,
    persistedAsDocument: false, executionAuthorized: false,
  } as never);
  try {
    await open();
    await upload(new File([new Uint8Array(256 * 1024 + 1)],
      "large.png", { type: "image/png" }));
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0]?.[1]).toMatchObject({ mimeType: "image/jpeg",
      language: "eng+ara" });
    expect(toBlob).toHaveBeenCalled();
    expect(draw).toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  } finally {
    Object.defineProperty(globalThis, "createImageBitmap",
      { configurable: true, value: nativeBitmap });
  }
});

it("rejects malicious oversized image dimensions before allocating a canvas", async () => {
  const close = vi.fn();
  const previous = globalThis.createImageBitmap;
  Object.defineProperty(globalThis, "createImageBitmap", {
    configurable: true,
    value: vi.fn().mockResolvedValue({ width: 9_000, height: 9_000, close }),
  });
  const canvas = vi.spyOn(document, "createElement");
  try {
    await open();
    await upload(new File([new Uint8Array(256 * 1024 + 1)],
      "oversized.png", { type: "image/png" }));
    expect(mockPost).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("pixel limit");
    expect(close).toHaveBeenCalledOnce();
    expect(canvas).not.toHaveBeenCalledWith("canvas");
  } finally {
    Object.defineProperty(globalThis, "createImageBitmap",
      { configurable: true, value: previous });
  }
});

it("honors an already canceled image operation before browser decode", async () => {
  const { readBostanOcrImage } = await import("./BostanOcrPreview");
  const aborted = new AbortController();
  aborted.abort();
  await expect(readBostanOcrImage(new File([new Uint8Array(256 * 1024 + 1)],
    "canceled.png", { type: "image/png" }), aborted.signal))
    .rejects.toThrow("canceled");
});
