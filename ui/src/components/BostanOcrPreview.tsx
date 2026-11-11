import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { Button } from "./ui/button";

const MAX_IMAGE_BYTES = 256 * 1024;
const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 18_000_000;
const MAX_SOURCE_DIMENSION = 8_192;
const MIME = new Set(["image/png", "image/jpeg"]);
type OcrLanguage = "eng" | "ara" | "eng+ara";
type OcrPreview = {
  text: string;
  truncated: boolean;
  sourceContentIsUntrusted: true;
  provenanceVerified: false;
  factualRelevanceVerified: false;
  decisionCommitAuthorized: false;
  persistedAsDocument: false;
  executionAuthorized: false;
};

function readBoundedImageData(file: Blob, mimeType: string): Promise<{ mimeType: string; base64: string }> {
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    return Promise.reject(new Error("Local OCR image was not reduced to the private server size limit."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read this image locally."));
    reader.onload = () => {
      const result = reader.result;
      const match = typeof result === "string"
        ? /^data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/]+=*)$/.exec(result)
        : null;
      if (!match) { reject(new Error("Unsupported image data.")); return; }
      resolve({ mimeType, base64: match[1] });
    };
    reader.readAsDataURL(file);
  });
}

function canvasJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob && blob.type === "image/jpeg"
      ? resolve(blob) : reject(new Error("Offline browser JPEG preprocessing is not supported.")),
    "image/jpeg", quality);
  });
}

/** Images never leave the browser except as bounded same-origin Bostan OCR input. */
export async function readBostanOcrImage(
  file: File,
  signal?: AbortSignal,
): Promise<{ mimeType: string; base64: string }> {
  if (!MIME.has(file.type) || file.size === 0 || file.size > MAX_SOURCE_BYTES) {
    throw new Error("Choose a PNG or JPEG image up to 4 MiB.");
  }
  if (signal?.aborted) throw new Error("Local OCR was canceled.");
  if (file.size <= MAX_IMAGE_BYTES) return readBoundedImageData(file, file.type);
  if (typeof createImageBitmap !== "function") {
    throw new Error("Offline browser image processing is unavailable.");
  }

  // Limit source-byte intake before decoding, then bound source pixel count
  // before canvas allocation. Never accept user-controlled JPEG quality or
  // output dimensions, which could exceed the private OCR server contract.
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Could not decode this local PNG/JPEG image.");
  }
  try {
    if (signal?.aborted) throw new Error("Local OCR was canceled.");
    if (bitmap.width <= 0 || bitmap.height <= 0 ||
        bitmap.width > MAX_SOURCE_DIMENSION || bitmap.height > MAX_SOURCE_DIMENSION ||
        bitmap.width * bitmap.height > MAX_SOURCE_PIXELS) {
      throw new Error("This image exceeds the supported local OCR pixel limit.");
    }
    const canvas = document.createElement("canvas");
    for (const maxSide of [2000, 1700, 1450, 1200, 980]) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Local image processing is not available.");
      // token-extraction: allowlisted — JPEG alpha flattening uses white image
      // pixels in every theme; this is OCR input data, not a UI surface color.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.86, 0.73, 0.59, 0.45]) {
        if (signal?.aborted) throw new Error("Local OCR was canceled.");
        const compressed = await canvasJpeg(canvas, quality);
        if (compressed.size > 0 && compressed.size <= MAX_IMAGE_BYTES) {
          return readBoundedImageData(compressed, "image/jpeg");
        }
      }
    }
    throw new Error("This image cannot fit the private OCR limit without losing too much detail.");
  } finally {
    bitmap.close();
  }
}

/** Read-only, opt-in OCR. Never saves the preview as a document or evidence. */
export function BostanOcrPreview({ companyId, issueId }: { companyId: string; issueId: string }) {
  const [opened, setOpened] = useState(false);
  const [language, setLanguage] = useState<OcrLanguage>("eng+ara");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OcrPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const requestAbort = useRef<AbortController | null>(null);
  useEffect(() => () => {
    requestId.current += 1;
    requestAbort.current?.abort();
    requestAbort.current = null;
  }, []);

  const onImage = async (file?: File) => {
    if (!file || busy) return;
    const current = ++requestId.current;
    requestAbort.current?.abort();
    const controller = new AbortController();
    requestAbort.current = controller;
    setResult(null);
    setError(null);
    setBusy(true);
    try {
      const image = await readBostanOcrImage(file, controller.signal);
      if (current !== requestId.current || controller.signal.aborted) return;
      const next = await api.post<OcrPreview>(
        "/companies/" + companyId + "/issues/" + issueId + "/bostan-evidence/ocr-preview",
        { ...image, language },
        { signal: controller.signal },
      );
      if (current !== requestId.current) return;
      if (typeof next.text !== "string" || next.sourceContentIsUntrusted !== true ||
          next.provenanceVerified !== false || next.factualRelevanceVerified !== false ||
          next.decisionCommitAuthorized !== false ||
          next.persistedAsDocument !== false || next.executionAuthorized !== false) {
        throw new Error("OCR preview returned an unexpected response.");
      }
      setResult(next);
    } catch (cause) {
      if (current === requestId.current) {
        setError(cause instanceof Error && (
          cause.message.startsWith("Choose a PNG or JPEG image") ||
          cause.message === "This image exceeds the supported local OCR pixel limit." ||
          cause.message === "This image cannot fit the private OCR limit without losing too much detail."
        ) ? cause.message : "Local OCR preview was unavailable or could not read the image.");
      }
    } finally {
      if (current === requestId.current) {
        requestAbort.current = null;
        setBusy(false);
      }
    }
  };

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" onClick={() => {
        requestId.current += 1;
        requestAbort.current?.abort();
        requestAbort.current = null;
        setBusy(false);
        setResult(null);
        setError(null);
        setOpened(value => !value);
      }}>
        {opened ? "Close image OCR" : "Extract text from image"}
      </Button>
      {opened && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">
            Local image OCR preview only. Extracted text is untrusted and is not saved as a document or citation.
          </p>
          <label className="block space-y-1 text-sm">
            <span>OCR language</span>
            <select aria-label="OCR language" value={language}
              onChange={event => setLanguage(event.target.value as OcrLanguage)}
              className="block rounded-md border border-input bg-background p-2">
              <option value="eng+ara">English + Arabic</option>
              <option value="eng">English</option>
              <option value="ara">العربية</option>
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span>Image (PNG/JPEG, up to 4 MiB; large images reduced locally)</span>
            <input aria-label="OCR image" type="file" accept="image/png,image/jpeg"
              disabled={busy}
              onChange={event => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void onImage(file);
              }}
              className="block max-w-full text-sm" />
          </label>
          {busy && <p role="status" className="text-sm">Preparing image and extracting locally…</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {result && (
            <label className="block space-y-1 text-sm">
              <span>Untrusted extracted preview (not saved)</span>
              <textarea aria-label="Extracted OCR text" readOnly value={result.text}
                className="min-h-32 w-full rounded-md border border-input bg-background p-2 font-mono text-xs" />
              {result.truncated && <span className="block text-xs text-muted-foreground">Preview limited to 2,000 characters.</span>}
            </label>
          )}
        </div>
      )}
    </div>
  );
}
