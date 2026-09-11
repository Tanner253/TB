/**
 * Plain-language payout failures.
 *
 * Raw chain errors leak into the payout history, and they read far worse than
 * what actually happened. "Transaction simulation failed: Blockhash not found"
 * is a Solana RPC transient — the transaction expired before a node picked it
 * up — but to a holder it looks like the protocol is broken.
 *
 * The rule here is to be clearer without being softer: every message says
 * plainly that the payout did not land and what happens next. Nothing is
 * dressed up as a success, and the raw error is kept alongside so support and
 * the operator can still see exactly what the chain said.
 *
 * An unrecognised error is NOT laundered into a friendly sentence — it falls
 * through mostly intact, because silently generalising an error we have never
 * seen is how real bugs get hidden.
 */

export interface PayoutErrorCopy {
  /** One line for the UI. */
  message: string
  /** True when the cause is transient and the cycle retries on its own. */
  retried: boolean
  /** The original chain error, for tooltips and support. */
  raw: string
}

interface Rule {
  match: RegExp
  message: string
  retried: boolean
}

const RULES: Rule[] = [
  // --- transient network / inclusion problems ---
  {
    match: /blockhash not found|block height exceeded|transaction expired|expired transaction/i,
    message: 'Network was congested and the transfer expired before it landed — retried automatically',
    retried: true,
  },
  {
    match: /timeout|timed out|econnreset|etimedout|socket hang up/i,
    message: 'The network did not confirm in time — retried automatically',
    retried: true,
  },
  {
    match: /429|too many requests|rate limit/i,
    message: 'Chain provider was rate limiting — retried automatically',
    retried: true,
  },
  {
    match: /nonce too low|replacement transaction underpriced|already known/i,
    message: 'A competing transaction took the slot — retried automatically',
    retried: true,
  },

  // --- real, actionable conditions ---
  {
    match: /insufficient (funds|balance|lamports)|exceeds distributable/i,
    message: 'Reward pool ran short before this payout — top up the payout wallet',
    retried: false,
  },
  {
    match: /token_not_tradable|no route|no routes found|could not find any route/i,
    message: 'No market route for this token at the time — liquidity was too thin to buy',
    retried: false,
  },
  {
    match: /slippage|price impact|min(imum)? ?tokens? ?out/i,
    message: 'Price moved too far mid-trade and the buy was cancelled to protect the pool',
    retried: true,
  },
  {
    match: /out of gas|gas required exceeds|intrinsic gas/i,
    message: 'Gas estimate fell short — retried automatically',
    retried: true,
  },
  {
    match: /revert/i,
    message: 'The trade was rejected on-chain and no funds moved',
    retried: false,
  },
]

/** Strips the layers of prefix chains bolt onto their errors. */
function tidy(raw: string): string {
  return raw
    .replace(/^(Error:\s*)+/i, '')
    .replace(/^Failed to send transaction:\s*/i, '')
    .replace(/^Transaction simulation failed:\s*/i, '')
    .trim()
}

export function humanizePayoutError(raw: string | null | undefined): PayoutErrorCopy | null {
  const original = (raw ?? '').trim()
  if (!original) return null

  for (const rule of RULES) {
    if (rule.match.test(original)) {
      return { message: rule.message, retried: rule.retried, raw: original }
    }
  }

  // Unknown: keep the substance, just drop the boilerplate prefixes so it
  // reads as a sentence rather than a stack trace.
  const cleaned = tidy(original)
  return {
    message: cleaned.length > 140 ? `${cleaned.slice(0, 137)}…` : cleaned,
    retried: false,
    raw: original,
  }
}
