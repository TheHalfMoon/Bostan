/**
 * Bostan private Windows QA. Bound actual localhost health polling by one
 * monotonic elapsed-time deadline rather than probe count * per-probe timeout.
 * Never accepts an external health endpoint or exposes HTTP response bodies.
 */
import {performance} from 'node:perf_hooks';

export const WINDOWS_PRIVATE_HTTP_STARTUP_MS = 180_000;
export const WINDOWS_PRIVATE_HTTP_MAX_PROBES = 180;

function endpointAllowed(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' && url.hostname === '127.0.0.1' &&
      Number(url.port) >= 1024 && Number(url.port) <= 65535 &&
      url.pathname === '/api/health' && url.search === '' && url.hash === '' &&
      url.username === '' && url.password === '';
  } catch { return false; }
}

function healthObservation(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return 'health_invalid';
  return 'health_' + (json.status === 'ok' ? 'ok' : 'non_ok') + '_' +
    (json.deploymentMode === 'authenticated' ? 'authenticated' : 'other_mode') + '_' +
    (json.bootstrapStatus === 'bootstrap_pending' ? 'pending' : 'other_bootstrap');
}

// A fetch implementation can return HTTP headers while leaving response.json()
// pending indefinitely. The same owned, ref'd timer bounds BOTH phases even if
// an injected fetch ignores AbortSignal. Late promise rejection is observed.
function awaitAbortable(promise, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(Error('Health request timed out')); return; }
    const abort = () => { signal.removeEventListener('abort', abort); reject(Error('Health request timed out')); };
    signal.addEventListener('abort', abort, {once:true});
    Promise.resolve(promise).then(
      value => { signal.removeEventListener('abort', abort); resolve(value); },
      error => { signal.removeEventListener('abort', abort); reject(error); },
    );
  });
}

export async function waitForWindowsPrivateHealth({
  endpoint, childExited, fetchResponse = fetch,
  now = () => performance.now(),
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  timeoutMs = WINDOWS_PRIVATE_HTTP_STARTUP_MS,
  requestTimeoutMs = 1500, pollDelayMs = 1000,
  maxProbes = WINDOWS_PRIVATE_HTTP_MAX_PROBES,
} = {}) {
  if (!endpointAllowed(endpoint) || typeof childExited !== 'function' ||
    typeof fetchResponse !== 'function' || typeof now !== 'function' ||
    typeof sleep !== 'function' ||
    ![timeoutMs, requestTimeoutMs, maxProbes].every(Number.isSafeInteger) ||
    timeoutMs < 1 || timeoutMs > WINDOWS_PRIVATE_HTTP_STARTUP_MS ||
    requestTimeoutMs < 1 || requestTimeoutMs > 1500 ||
    !Number.isSafeInteger(pollDelayMs) || pollDelayMs < 0 || pollDelayMs > 1000 ||
    maxProbes < 1 || maxProbes > WINDOWS_PRIVATE_HTTP_MAX_PROBES) {
    throw Error('Invalid private localhost startup probe configuration');
  }
  const start = now();
  const deadline = start + timeoutMs;
  let probes = 0;
  let observation = 'no_response';
  const receipt = (outcome, healthy = false) => Object.freeze({
    healthy, outcome, probes, observation,
    elapsedMs: Math.max(0, Math.round(now() - start)),
  });
  while (true) {
    if (childExited()) return receipt('child_exited');
    const remaining = Math.floor(deadline - now());
    if (remaining <= 0) return receipt('deadline_exceeded');
    if (probes >= maxProbes) return receipt('probe_limit');
    probes += 1;
    const controller = new AbortController();
    // One ref'd timeout covers headers AND the complete JSON body. Clearing it
    // after both phases prevents a late abort from affecting another probe.
    const timer = setTimeout(() => controller.abort(),
      Math.max(1, Math.min(requestTimeoutMs, remaining)));
    try {
      const response = await awaitAbortable(fetchResponse(endpoint, {
        redirect: 'error', signal: controller.signal,
      }), controller.signal);
      if (response.status === 200) {
        let json;
        try { json = await awaitAbortable(response.json(), controller.signal); }
        catch { observation = 'health_invalid_json'; }
        if (json !== undefined) {
          observation = healthObservation(json);
          // A valid body arriving AFTER the deadline, or after the owned child
          // exited, must never produce a green Windows startup receipt.
          if (childExited()) return receipt('child_exited');
          if (controller.signal.aborted || now() >= deadline)
            return receipt('deadline_exceeded');
          if (json && json.status === 'ok' &&
            json.deploymentMode === 'authenticated' &&
            json.deploymentExposure === 'private' &&
            json.bootstrapStatus === 'bootstrap_pending' &&
            !Object.hasOwn(json, 'cloud')) return receipt('healthy', true);
        }
      } else {
        const status = Number(response?.status);
        observation = Number.isSafeInteger(status) && status >= 100 && status <= 599
          ? 'http_'+status : 'http_invalid_status';
      }
    } catch { observation = 'no_response'; }
    finally { clearTimeout(timer); }
    if (childExited()) return receipt('child_exited');
    const rest = Math.floor(deadline - now());
    if (rest <= 0) return receipt('deadline_exceeded');
    if (probes >= maxProbes) return receipt('probe_limit');
    if (pollDelayMs > 0) await sleep(Math.min(pollDelayMs, rest));
  }
}
