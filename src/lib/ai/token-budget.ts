/**
 * Paces model calls to a tokens-per-minute limit (free tiers like Groq's allow
 * ~8,000 TPM). Requests wait in line until the last minute's usage plus the
 * next request's estimate fits, instead of failing with 429s. Once a call
 * returns, its estimate is replaced by the real count, so a cautious estimate
 * doesn't slow the next calls down.
 */
export class TokenBudget {
  private used: { at: number; tokens: number }[] = [];
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly tokensPerMinute: number) {}

  /** Waits until `estimate` tokens fit in the current minute, then reserves them. Call `settle` with the real count afterwards. */
  reserve(estimate: number): Promise<{ settle: (actualTokens: number) => void }> {
    const entry = { at: 0, tokens: estimate };
    const turn = this.queue.then(async () => {
      for (;;) {
        const now = Date.now();
        this.used = this.used.filter((u) => now - u.at < 60_000);
        const inWindow = this.used.reduce((sum, u) => sum + u.tokens, 0);
        if (inWindow + estimate <= this.tokensPerMinute || this.used.length === 0) break;
        const oldest = this.used[0]!;
        await new Promise((resolve) => setTimeout(resolve, 60_000 - (now - oldest.at) + 250));
      }
      entry.at = Date.now();
      this.used.push(entry);
    });
    this.queue = turn.catch(() => undefined);
    return turn.then(() => ({
      settle: (actualTokens: number) => {
        if (actualTokens > 0) entry.tokens = actualTokens;
      },
    }));
  }
}

/** Rough token estimate: ~4 characters per token, plus room for the answer. */
export function estimateTokens(promptChars: number, outputTokens = 600): number {
  return Math.ceil(promptChars / 4) + outputTokens;
}
