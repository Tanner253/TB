import { config } from '@/lib/config'
import { isExcludedParticipantWallet } from '@/lib/eligibility/excludedWallets'
import {
  ensureLiquidityPoolAddresses,
  isLiquidityPoolWallet,
} from '@/lib/eligibility/liquidityPools'
import { getTokenHolders } from '@/lib/solana/indexer'
import { meetsMinTokenHoldingFromChain } from '@/lib/solana/tokenAmount'

export interface OnChainHolderStats {
  /** All wallets with token balance > 0 (includes LP / protocol) */
  raw: number
  /** Wallets excluding LP pool and protocol/dev exclusions */
  trackable: number
  /** Trackable wallets meeting MIN_TOKEN_HOLDING */
  qualifying: number
}

/**
 * Live holder counts from Helius — used to refresh stale DB totals on each leaderboard poll.
 */
export async function getOnChainHolderStats(mint: string): Promise<OnChainHolderStats> {
  if (!mint) {
    return { raw: 0, trackable: 0, qualifying: 0 }
  }

  await ensureLiquidityPoolAddresses(mint)
  const raw = await getTokenHolders(mint, Math.min(config.maxHoldersToProcess, 1000))

  let trackable = 0
  let qualifying = 0

  for (const h of raw) {
    if (h.isContract) continue
    if (isExcludedParticipantWallet(h.wallet)) continue
    if (isLiquidityPoolWallet(h.wallet, mint)) continue

    trackable++
    if (meetsMinTokenHoldingFromChain(h.balance, config.tokenDecimals, config.minTokenHolding)) {
      qualifying++
    }
  }

  return {
    raw: raw.length,
    trackable,
    qualifying,
  }
}
