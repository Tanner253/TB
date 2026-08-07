import { getTokenHolders as heliusGetHolders } from './helius'
import { config } from '@/lib/config'

export interface TokenHolder {
  wallet: string
  balance: number
  balanceRaw: number
}

// Fetch all token holders using Helius (REAL DATA)
export async function fetchAllHolders(mint?: string): Promise<TokenHolder[]> {
  const tokenMint = mint || config.tokenMint

  if (!tokenMint) {
    console.warn('No token mint configured')
    return []
  }

  if (!process.env.HELIUS_API_KEY) {
    console.error('HELIUS_API_KEY is required')
    return []
  }

  const holders = await heliusGetHolders(tokenMint, config.maxHoldersToProcess)

  return holders.map(h => ({
    wallet: h.wallet,
    balance: h.balance / Math.pow(10, config.tokenDecimals),
    balanceRaw: h.balance,
  }))
}

// Format wallet address for display
export function formatWallet(wallet: string): string {
  if (!wallet || wallet.length <= 8) return wallet || ''
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
}
