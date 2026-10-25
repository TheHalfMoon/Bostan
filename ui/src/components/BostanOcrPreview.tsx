import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { Button } from "./ui/button";

const MAX_IMAGE_BYTES = 256 * 1024;
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

export function readBostanOcrImage(file: File): Promise<{ mimeType: string; base64: string }> {
  if (!MIME.has(file.type) || file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    return Promise.reject(new Error("Choose a PNG or JPEG image up to 256 KiB."));
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
      resolve({ mimeType: file.type, base64: match[1] });
    };
    reader.readAsDataURL(file);
  });
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
      const image = await readBostanOcrImage(file);
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
        setError(cause instanceof Error && cause.message === "Choose a PNG or JPEG image up to 256 KiB."
          ? cause.message : "Local OCR preview was unavailable or could not read the image.");
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
            <span>Image (PNG/JPEG, max 256 KiB)</span>
            <input aria-label="OCR image" type="file" accept="image/png,image/jpeg"
              disabled={busy}
              onChange={event => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void onImage(file);
              }}
              className="block max-w-full text-sm" />
          </label>
          {busy && <p role="status" className="text-sm">Extracting locally…</p>}
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
