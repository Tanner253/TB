/**
 * Wallets that must never rank or receive loss-mining payouts
 * (payout pool wallet, dev fee wallet, optional EXCLUDED_WALLETS).
 */

import { isAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { config } from '@/lib/config'

const PROTOCOL_WALLET_REASON = 'Protocol wallet excluded'

let cachedExcluded: Set<string> | null = null

/** Derive payout wallet address from PAYOUT_WALLET_PRIVATE_KEY (no RPC). */
export function getPayoutWalletAddressFromEnv(): string | null {
  const key = process.env.PAYOUT_WALLET_PRIVATE_KEY
  if (!key) return null
  const hexBody = key.startsWith('0x') ? key.slice(2) : key
  if (!/^[0-9a-fA-F]{64}$/.test(hexBody)) return null
  const normalized = key.startsWith('0x') ? key : `0x${key}`
  try {
    return privateKeyToAccount(normalized as `0x${string}`).address.toLowerCase()
  } catch {
    return null
  }
}

export function getExcludedParticipantWallets(): Set<string> {
  if (cachedExcluded) return cachedExcluded

  const excluded = new Set<string>()

  const payout = getPayoutWalletAddressFromEnv()
  if (payout) excluded.add(payout)

  if (config.devWalletAddress && isAddress(config.devWalletAddress)) {
    excluded.add(config.devWalletAddress.toLowerCase())
  }

  const extra = process.env.EXCLUDED_WALLETS || ''
  for (const part of extra.split(',')) {
    const addr = part.trim()
    if (addr && isAddress(addr)) {
      excluded.add(addr.toLowerCase())
    }
  }

  cachedExcluded = excluded
  return excluded
}

export function isExcludedParticipantWallet(wallet: string): boolean {
  if (!wallet) return false
  return getExcludedParticipantWallets().has(wallet.toLowerCase())
}

export function getProtocolWalletExclusionReason(): string {
  return PROTOCOL_WALLET_REASON
}

/** Clear cache after env changes (tests). */
export function resetExcludedWalletCache(): void {
  cachedExcluded = null
}
