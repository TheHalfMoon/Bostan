/** Fixed-window limiter keyed by caller. Memory is bounded by pruning expired windows. */
export class RateLimiter {
  readonly #windows = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  allow(key: string): boolean {
    const now = this.now();
    if (this.#windows.size > 10_000) {
      for (const [entry, window] of this.#windows) if (window.resetAt <= now) this.#windows.delete(entry);
    }
    const window = this.#windows.get(key);
    // Fail closed for new callers rather than growing without bound.
    if (!window && this.#windows.size > 10_000) return false;
    if (!window || window.resetAt <= now) {
      this.#windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (window.count >= this.limit) return false;
    window.count += 1;
    return true;
  }
}
