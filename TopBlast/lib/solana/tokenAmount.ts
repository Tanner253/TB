/**
 * SPL token amounts from RPC are raw integer units; UI and eligibility use human token counts.
 */

export function rawToHumanTokenAmount(raw: number, decimals: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0
  const scale = Math.pow(10, decimals)
  return raw / scale
}

/**
 * Accept either human or raw balance — raw values are far larger than any realistic human holding.
 */
export function normalizeTokenBalance(
  balance: number,
  decimals: number,
  minHumanHolding = 1
): number {
  if (!Number.isFinite(balance) || balance <= 0) return 0
  const scale = Math.pow(10, decimals)
  const threshold = Math.max(minHumanHolding, 1) * scale
  if (balance >= threshold) {
    return balance / scale
  }
  return balance
}

export function formatTokenBalance(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0'
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) {
    return amount.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }
  if (abs >= 1) {
    return amount.toLocaleString('en-US', { maximumFractionDigits: 2 })
  }
  return amount.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

export function meetsMinTokenHoldingFromChain(
  rawBalance: number,
  decimals: number,
  minHumanHolding: number
): boolean {
  return rawToHumanTokenAmount(rawBalance, decimals) >= minHumanHolding
}
