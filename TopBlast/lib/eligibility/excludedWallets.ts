/**
 * Wallets that must never rank or receive loss-mining payouts
 * (payout pool wallet, dev fee wallet, optional EXCLUDED_WALLETS).
 */

import { Keypair, PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import { config } from '@/lib/config'
import { getPayoutPrivateKey, getTenantSlug } from '@/lib/tenant/context'

const PROTOCOL_WALLET_REASON = 'Protocol wallet excluded'

const cachedExcludedByTenant = new Map<string, Set<string>>()
function isValidSolanaAddress(address: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}

/** Derive payout wallet address from active tenant or env private key. */
export function getPayoutWalletAddressFromEnv(): string | null {
  const key = getPayoutPrivateKey()
  if (!key) return null

  try {
    const decoded = bs58.decode(key)
    return Keypair.fromSecretKey(decoded).publicKey.toBase58()
  } catch {
    return null
  }
}

export function getExcludedParticipantWallets(): Set<string> {
  const slug = getTenantSlug()
  const cached = cachedExcludedByTenant.get(slug)
  if (cached) return cached

  const excluded = new Set<string>()
  const payout = getPayoutWalletAddressFromEnv()
  if (payout) excluded.add(payout)

  if (config.devWalletAddress && isValidSolanaAddress(config.devWalletAddress)) {
    excluded.add(config.devWalletAddress)
  }

  const extra = process.env.EXCLUDED_WALLETS || ''
  for (const part of extra.split(',')) {
    const addr = part.trim()
    if (addr && isValidSolanaAddress(addr)) {
      excluded.add(addr)
    }
  }

  cachedExcludedByTenant.set(slug, excluded)
  return excluded
}
export function isExcludedParticipantWallet(wallet: string): boolean {
  if (!wallet) return false
  return getExcludedParticipantWallets().has(wallet)
}

export function getProtocolWalletExclusionReason(): string {
  return PROTOCOL_WALLET_REASON
}

export function resetExcludedWalletCache(): void {
  cachedExcludedByTenant.delete(getTenantSlug())
}