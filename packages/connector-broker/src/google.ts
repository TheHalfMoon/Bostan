export const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOCATION_ENDPOINT = "https://oauth2.googleapis.com/revoke";

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 64 * 1024;
const RETRY_DELAYS_MS = [250, 1_000];

export type ProviderTokens = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  expiresInSeconds: number | null;
  scopes: string[] | null;
};

/** `invalid_grant` means the user or provider revoked consent; `transient` may succeed later. */
export class ProviderError extends Error {
  constructor(readonly kind: "invalid_grant" | "transient" | "rejected") {
    super(`Google OAuth request failed (${kind})`);
    this.name = "ProviderError";
  }
}

export type GoogleClient = {
  authorizationUrl(input: { redirectUri: string; scopes: readonly string[]; state: string; codeChallenge: string }): string;
  exchangeCode(input: { code: string; codeVerifier: string; redirectUri: string }): Promise<ProviderTokens>;
  refresh(refreshToken: string): Promise<ProviderTokens>;
  revoke(token: string): Promise<void>;
};

export function createGoogleClient(input: {
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}): GoogleClient {
  const request = input.fetch ?? fetch;
  const sleep = input.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  async function post(url: string, form: Record<string, string>, retry: boolean): Promise<Record<string, unknown>> {
    const attempts = retry ? RETRY_DELAYS_MS.length + 1 : 1;
    let lastError: ProviderError = new ProviderError("transient");
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]!);
      let response: Response;
      try {
        response = await request(url, {
          method: "POST",
          redirect: "error",
          headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
          body: new URLSearchParams(form).toString(),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch {
        lastError = new ProviderError("transient");
        continue;
      }
      const body = await readBoundedJson(response);
      if (response.ok) return body ?? {};
      if (response.status === 429 || response.status >= 500) {
        lastError = new ProviderError("transient");
        continue;
      }
      throw new ProviderError(body?.error === "invalid_grant" ? "invalid_grant" : "rejected");
    }
    throw lastError;
  }

  function parseTokens(body: Record<string, unknown>): ProviderTokens {
    if (typeof body.access_token !== "string" || body.access_token.length === 0) throw new ProviderError("rejected");
    return {
      accessToken: body.access_token,
      refreshToken: typeof body.refresh_token === "string" && body.refresh_token ? body.refresh_token : null,
      tokenType: typeof body.token_type === "string" ? body.token_type : "Bearer",
      expiresInSeconds: typeof body.expires_in === "number" && body.expires_in > 0 ? body.expires_in : null,
      scopes: typeof body.scope === "string" ? body.scope.split(" ").filter(Boolean) : null,
    };
  }

  return {
    authorizationUrl({ redirectUri, scopes, state, codeChallenge }) {
      const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
      url.search = new URLSearchParams({
        client_id: input.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: [...scopes].join(" "),
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        // A refresh token is required for the instance's refresh handle;
        // prompting guarantees Google returns one on re-consent.
        access_type: "offline",
        prompt: "consent",
      }).toString();
      return url.toString();
    },
    async exchangeCode({ code, codeVerifier, redirectUri }) {
      // Authorization codes are single-use, so a failed exchange is never retried.
      return parseTokens(await post(GOOGLE_TOKEN_ENDPOINT, {
        client_id: input.clientId,
        client_secret: input.clientSecret,
        code,
        code_verifier: codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }, false));
    },
    async refresh(refreshToken) {
      return parseTokens(await post(GOOGLE_TOKEN_ENDPOINT, {
        client_id: input.clientId,
        client_secret: input.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }, true));
    },
    async revoke(token) {
      await post(GOOGLE_REVOCATION_ENDPOINT, { token }, true);
    },
  };
}

async function readBoundedJson(response: Response): Promise<Record<string, unknown> | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) return null;
      chunks.push(value);
    }
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  } finally {
    void reader.cancel().catch(() => {});
  }
}
