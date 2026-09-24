/**
 * Retry a chain read with a short, widening backoff.
 *
 * The Robinhood RPC rate-limits hard and refuses a meaningful share of calls
 * under load. A single refusal inside a payout used to fail the whole cycle,
 * so reads on the payout path go through this.
 */
export async function withRpcRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      last = err
      if (i < attempts - 1) await new Promise(r => setTimeout(r, 250 * (i + 1)))
    }
  }
  throw last
}
