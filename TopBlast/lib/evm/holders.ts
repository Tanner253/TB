import { getTokenHolders as evmGetHolders } from './indexer'
import { config } from '@/lib/config'

export interface TokenHolder {
  wallet: string
  balance: number
  balanceRaw: number
}

export async function fetchAllHolders(tokenAddress?: string): Promise<TokenHolder[]> {
  const address = tokenAddress || config.tokenMint

  if (!address) {
    console.warn('No token contract configured')
    return []
  }

  const holders = await evmGetHolders(address, config.maxHoldersToProcess)

  return holders.map(h => ({
    wallet: h.wallet,
    balance: h.balance / Math.pow(10, config.tokenDecimals),
    balanceRaw: h.balance,
  }))
}

export function formatWallet(wallet: string): string {
  if (!wallet || wallet.length <= 10) return wallet || ''
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
}
