/**
 * Solana indexer — Helius DAS + Enhanced Transactions
 * API-compatible with the former EVM indexer surface used by holderService / API routes.
 */

import { config } from '@/lib/config'
import {
  getTokenHolders as heliusGetTokenHolders,
  getWalletTransactions,
  getHolderCount,
  checkHeliusHealth,
  ParsedTransaction,
} from './helius'
import { ensureLiquidityPoolAddresses, isLiquidityPoolWallet } from '@/lib/eligibility/liquidityPools'

export type { ParsedTransaction }

export async function getTokenHolders(
  mint: string,
  limit: number = 1000
): Promise<{ wallet: string; balance: number; isContract: boolean }[]> {
  if (!mint) return []

  await ensureLiquidityPoolAddresses(mint)
  const raw = await heliusGetTokenHolders(mint, limit)
  return raw.map(h => ({
    wallet: h.wallet,
    balance: h.balance,
    isContract: isLiquidityPoolWallet(h.wallet, mint),
  }))
}

export async function getEarliestBuyTimestamp(
  wallet: string,
  mint: string,
  limit: number = 100
): Promise<number | null> {
  const txs = await getWalletTransactions(wallet, mint, limit)
  let earliest: number | null = null

  for (const tx of txs) {
    if (tx.type !== 'BUY') continue
    if (earliest === null || tx.timestamp < earliest) {
      earliest = tx.timestamp
    }
  }

  return earliest
}

export { getWalletTransactions, getHolderCount, checkHeliusHealth as checkRpcHealth }
