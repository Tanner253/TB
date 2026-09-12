import 'server-only'

/**
 * The Solana-era flywheel, measured rather than remembered.
 *
 * The buyback program ran manually before the migration, so there are no
 * TopBlast records of it — but its effect is on-chain and permanent. A
 * pump.fun mint has no mint authority after launch, so its supply can only
 * ever go down, and the only way down is a burn. That makes
 *
 *     burned = initial supply − current supply
 *
 * a figure anyone can reproduce from the mint in one RPC call, which is
 * exactly the property the flywheel panel is trying to have.
 *
 * What this deliberately does NOT do is invent a spend. We know what supply
 * was destroyed; we do not have a verifiable record of the SOL spent
 * destroying it, and a number nobody can check is worth less than no number.
 */

import { Connection, PublicKey } from '@solana/web3.js'

/**
 * The pre-migration platform token. A historical constant: this mint is
 * retired, its supply is final apart from further burns, and hard-coding it
 * keeps the legacy figure intact after PLATFORM_TOKEN_MINT moves to Pons.
 */
export const LEGACY_PLATFORM_MINT = 'JAKnM5B8pC7747QqGEGyeJmdAn55mmjb2Eqd2bpSpump'

/** pump.fun mints launch at 1B and cannot mint more. */
export const LEGACY_INITIAL_SUPPLY = 1_000_000_000

export interface LegacyFlywheel {
  mint: string
  initialSupply: number
  currentSupply: number
  /** Supply permanently destroyed, in whole tokens. */
  burned: number
  /** Percent of the original supply destroyed. */
  burnedPct: number
}

let cache: { value: LegacyFlywheel | null; at: number } | null = null
const TTL_MS = 60 * 60 * 1000

/**
 * Reads the retired mint's live supply. Returns null on any failure — the
 * panel then shows only what it can prove, rather than a stale guess.
 */
export async function getLegacyFlywheel(): Promise<LegacyFlywheel | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value

  try {
    const { getHeliusRpcUrl } = await import('@/lib/solana/rpcUrl')
    const endpoint = getHeliusRpcUrl() || 'https://api.mainnet-beta.solana.com'
    const connection = new Connection(endpoint, 'confirmed')
    const supply = await connection.getTokenSupply(new PublicKey(LEGACY_PLATFORM_MINT))

    const currentSupply = Number(supply.value.uiAmountString ?? supply.value.uiAmount ?? 0)
    if (!Number.isFinite(currentSupply) || currentSupply <= 0) throw new Error('No supply returned')

    // Supply can only fall. A rise would mean our assumption about the mint
    // is wrong, so report nothing rather than a negative burn.
    const burned = LEGACY_INITIAL_SUPPLY - currentSupply
    if (burned < 0) throw new Error('Supply above initial — mint assumption broken')

    const value: LegacyFlywheel = {
      mint: LEGACY_PLATFORM_MINT,
      initialSupply: LEGACY_INITIAL_SUPPLY,
      currentSupply,
      burned,
      burnedPct: (burned / LEGACY_INITIAL_SUPPLY) * 100,
    }
    cache = { value, at: Date.now() }
    return value
  } catch (err) {
    console.warn('[LegacyFlywheel] Supply read failed:', err instanceof Error ? err.message : err)
    cache = { value: null, at: Date.now() }
    return null
  }
}
