/**
 * A single payout must not hand one wallet a chart-breaking share of supply.
 *
 * Paying winners in the session token is the point of the product — each cycle
 * is a real market buy, and the winner receives what it bought. But a large
 * pool against a small token can buy a double-digit percentage of supply, and
 * dropping that on one wallet does more damage to the chart than the buy did
 * good. The holder is then sitting on a position they cannot exit without
 * wrecking the token they were rewarded for holding.
 *
 * So the token leg is capped at a fixed share of supply and the winner is paid
 * the remainder in ETH. They receive the full value either way — this only
 * changes what it arrives as. Nothing is withheld, deferred, or rolled into a
 * later cycle, which matters because a winner is on cooldown next round and
 * would not be there to collect it.
 */

/** Most of a token's supply any single payout may deliver. */
export const MAX_PAYOUT_PCT_OF_SUPPLY = 3.5

export interface CappedPayout {
  /** ETH spent buying this winner's token leg. */
  tokenEth: number
  /** ETH paid directly to this winner, because the token leg hit the cap. */
  cashEth: number
  /** Tokens this winner receives — never above the cap. */
  tokens: number
  /** True when the cap actually bound, for logging and history. */
  capped: boolean
}

/**
 * Split one winner's payout between a capped token leg and an ETH remainder.
 *
 * `tokensPerEth` is an estimate from live prices; the real swap will differ by
 * slippage, so callers must ALSO clamp the delivered tokens. This decides how
 * much ETH to spend, not how many tokens finally move.
 */
export function splitPayoutAtSupplyCap(input: {
  amountEth: number
  tokensPerEth: number
  totalSupply: number
  maxPctOfSupply?: number
}): CappedPayout {
  const { amountEth, tokensPerEth, totalSupply } = input
  const pct = input.maxPctOfSupply ?? MAX_PAYOUT_PCT_OF_SUPPLY

  const unusable =
    !Number.isFinite(amountEth) ||
    amountEth <= 0 ||
    !Number.isFinite(tokensPerEth) ||
    tokensPerEth <= 0 ||
    !Number.isFinite(totalSupply) ||
    totalSupply <= 0 ||
    pct <= 0

  // Without a usable supply or price the cap cannot be reasoned about. Pay the
  // whole thing in tokens, exactly as before — a missing input must not
  // silently convert someone's payout to ETH.
  if (unusable) {
    return { tokenEth: amountEth, cashEth: 0, tokens: amountEth * tokensPerEth, capped: false }
  }

  const maxTokens = totalSupply * (pct / 100)
  const wantedTokens = amountEth * tokensPerEth
  if (wantedTokens <= maxTokens) {
    return { tokenEth: amountEth, cashEth: 0, tokens: wantedTokens, capped: false }
  }

  const tokenEth = maxTokens / tokensPerEth
  return {
    tokenEth,
    cashEth: Math.max(0, amountEth - tokenEth),
    tokens: maxTokens,
    capped: true,
  }
}

/** The cap in tokens, for clamping what a swap actually delivered. */
export function maxTokensPerPayout(totalSupply: number, maxPctOfSupply = MAX_PAYOUT_PCT_OF_SUPPLY): number {
  if (!Number.isFinite(totalSupply) || totalSupply <= 0) return Infinity
  return totalSupply * (maxPctOfSupply / 100)
}

/** Human-readable cap, for disclaimers and tooltips. */
export function supplyCapLabel(maxPctOfSupply = MAX_PAYOUT_PCT_OF_SUPPLY): string {
  return `${maxPctOfSupply}% of supply`
}
