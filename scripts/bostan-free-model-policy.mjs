// Keep this module free of side effects and top-level await. Both the
// direct Windows provider admission and the first-agent E2E load it.
// Do NOT import either executable script from here: that would create
// a deadlock when the first-agent CLI awaits an admission dynamic import.
const DEFAULT_MODEL = "opencode/deepseek-v4.1-flash-free";
const ALLOWED_MODELS = new Set([DEFAULT_MODEL, "opencode/beam-free"]);

export function qualifyFreeQaModel(value) {
  const model = value || DEFAULT_MODEL;
  if (!ALLOWED_MODELS.has(model)) {
    throw new Error("Only explicitly permitted free test models are allowed");
  }
  return model;
}
