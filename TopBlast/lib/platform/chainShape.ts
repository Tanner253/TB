/**
 * Which chain a token address belongs to, by shape alone.
 *
 * Deliberately dependency-free so client components can ask the same question
 * the server does — no viem, no config, no `server-only`. The policy built on
 * top of this lives in `lib/platform/legacyChain.ts`.
 */

/** A 20-byte hex address that isn't the zero address. */
export function isEvmAddressShape(value: string | null | undefined): boolean {
  const v = value?.trim() ?? ''
  return /^0x[0-9a-fA-F]{40}$/.test(v) && !/^0x0{40}$/i.test(v)
}

/**
 * True for a token on the chain TopBlast migrated away from.
 * Fails open on a blank value: absence of an address is not evidence of a
 * Solana one, and retiring a listing on a guess is worse than leaving it.
 */
export function isLegacyChainMint(mint: string | null | undefined): boolean {
  const trimmed = mint?.trim()
  if (!trimmed) return false
  return !isEvmAddressShape(trimmed)
}

/**
 * The native asset a listing settles in, by the chain its token lives on.
 *
 * Historical payouts must keep saying what they actually paid. A Solana
 * cycle paid SOL; relabelling it ETH after the migration would quietly
 * falsify the record, and the payout history is the one place users check
 * to confirm what they received.
 */
export function nativeUnitForMint(mint: string | null | undefined): 'SOL' | 'ETH' {
  return isLegacyChainMint(mint) ? 'SOL' : 'ETH'
}
