/**
 * Source-only, opt-in ZERO-cost OpenRouter admission. Never calls inference,
 * stores keys, updates auth files, selects a paid fallback, or accepts
 * arbitrary model slugs from CI/operator input.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { qualifyFreeQaModel, isOpenRouterFreeQaModel } from "./bostan-free-model-policy.mjs";

export function selectVerifiedFreeOpenRouterModel(catalog, qualifiedModel) {
  if (!isOpenRouterFreeQaModel(qualifiedModel)) {
    throw new Error("OpenRouter source QA accepts only explicitly allowlisted :free models");
  }
  const id = qualifiedModel.slice("openrouter/".length);
  const match = Array.isArray(catalog?.data)
    ? catalog.data.find(row => row && row.id === id) : null;
  const rates = match?.pricing;
  if (!match || !rates || !id.endsWith(":free") ||
      String(rates.prompt) !== "0" || String(rates.completion) !== "0" ||
      (rates.request !== undefined && String(rates.request) !== "0") ||
      !Array.isArray(match.supported_parameters) ||
      !match.supported_parameters.includes("tools")) {
    throw new Error("Refusing OpenRouter route not proven free and tool-capable by live provider catalog");
  }
  return qualifiedModel;
}

export function resolveLocalOpenRouterQaKey(env = process.env, home = os.homedir()) {
  const direct = env.OPENROUTER_API_KEY;
  if (typeof direct === "string" && /^sk-or-[A-Za-z0-9_-]{8,}$/.test(direct)) {
    return direct;
  }
  if (env.BOSTAN_E2E_USE_SAVED_OPENROUTER_AUTH !== "1") {
    throw new Error("OpenRouter free QA requires a key in OPENROUTER_API_KEY or explicit opt-in for saved local OpenCode auth");
  }
  if (!path.isAbsolute(home)) throw new Error("Refusing non-absolute operator home");
  const authFile = path.join(home, ".local", "share", "opencode", "auth.json");
  let key = "";
  try {
    const stat = fs.lstatSync(authFile);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 ||
        (typeof process.getuid === "function" && stat.uid !== process.getuid())) {
      throw new Error("Invalid local OpenCode auth file ownership or type");
    }
    const obj = JSON.parse(fs.readFileSync(authFile, "utf8"));
    if (obj?.openrouter?.type === "api") key = obj.openrouter.key;
  } catch {
    throw new Error("Saved OpenRouter auth is missing or unsafe; no key is exported");
  }
  if (typeof key !== "string" || !/^sk-or-[A-Za-z0-9_-]{8,}$/.test(key)) {
    throw new Error("Saved OpenRouter API credential is not usable; no key is exported");
  }
  return key;
}

export async function admitOpenRouterZeroCostQa({
  model, env = process.env, fetchCatalog = fetch, home = os.homedir(),
}) {
  const qualifiedModel = qualifyFreeQaModel(model);
  if (!isOpenRouterFreeQaModel(qualifiedModel) ||
      env.BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL !== "1") {
    throw new Error("Source OpenRouter QA requires explicit free-only model and online opt-in");
  }
  const key = resolveLocalOpenRouterQaKey(env, home);
  let response;
  try {
    response = await fetchCatalog("https://openrouter.ai/api/v1/models", {
      method: "GET", redirect: "error", signal: AbortSignal.timeout(15_000),
      headers: { "accept": "application/json" },
    });
    if (!response.ok) throw new Error("OpenRouter catalog unavailable");
  } catch {
    throw new Error("OpenRouter zero-price model catalog could not be verified");
  }
  let catalog;
  try { catalog = await response.json(); }
  catch { throw new Error("OpenRouter zero-price model catalog was invalid"); }
  return { model: selectVerifiedFreeOpenRouterModel(catalog, qualifiedModel), key };
}
