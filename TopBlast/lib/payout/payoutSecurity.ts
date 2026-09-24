import { isPonsSession, isEvmAddress, walletKey } from '@/lib/pons/session'
import 'server-only'

import { PublicKey } from '@solana/web3.js'
import { config } from '@/lib/config'
import { getPayoutPrivateKey } from '@/lib/tenant/context'
import { getTokenHolders } from '@/lib/solana/indexer'
import { isExcludedParticipantWallet } from '@/lib/eligibility/excludedWallets'
import type { PayableWinner } from '@/lib/payout/types'

/** SOL kept in the payout wallet after any cycle (rent + future tx fees). */
export function getMinWalletReserveSol(): number {
  if (isPonsSession()) { const eth = Number(process.env.MIN_WALLET_RESERVE_ETH ?? '0.0001'); return Number.isFinite(eth) && eth >= 0 ? eth : 0.0001 }
  const raw = parseFloat(process.env.MIN_WALLET_RESERVE_SOL || '0.01')
  return Number.isFinite(raw) && raw >= 0 ? raw : 0.01
}

/**
 * Valid payout recipient for the *current session's* chain: an 0x address on a
 * Pons listing, base58 on a legacy one. Named for its Solana origin; prefer the
 * `isValidPayoutAddress` alias below in new code.
 */
export function isValidSolanaAddress(address: string): boolean {
  if (isPonsSession()) return isEvmAddress(address)
  const trimmed = address?.trim()
  if (!trimmed) return false
  // Reject EVM-style hex addresses — Solana PublicKey can mis-parse some strings.
  if (/^0x/i.test(trimmed)) return false
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) return false
  try {
    const pk = new PublicKey(trimmed)
    return pk.toBase58() === trimmed
  } catch {
    return false
  }
}

export function assertProductionPayoutConfig(): string | null {
  if (!config.isProd || !config.executePayouts) return null

  if (!getPayoutPrivateKey()?.trim()) {
    return 'Payout wallet private key is missing'
  }

  const dev = config.devWalletAddress?.trim()
  if (dev && !isValidPayoutAddress(dev)) {
    return isPonsSession()
      ? 'DEV_WALLET_ADDRESS must be a 0x EVM address on Robinhood Chain'
      : 'DEV_WALLET_ADDRESS must be a valid base58 address (not an EVM 0x address)'
  }

  return null
}

/** Max SOL that may leave the wallet this cycle after reserve. */
export function maxDistributableSol(walletSol: number): number {
  const reserve = getMinWalletReserveSol()
  const poolCap = walletSol * config.poolPercentage
  const afterReserve = Math.max(0, walletSol - reserve)
  return Math.min(poolCap, afterReserve)
}

function holderOwnsSessionToken(wallet: string, balanceByWallet: Map<string, number>): boolean {
  const balance = balanceByWallet.get(walletKey(wallet))
  return balance != null && balance >= config.minTokenHolding
}

/** Keep only winners that still hold the session token on-chain at payout time. */
export async function filterWinnersHoldingSessionToken(
  winners: PayableWinner[],
  mint?: string
): Promise<PayableWinner[]> {
  const tokenMint = mint || config.tokenMint
  if (!tokenMint || winners.length === 0) return []

  // On Pons, check just the winners. The generic path re-read every holder's
  // balance and bytecode — ~70 calls for 35 holders to verify 1-3 wallets —
  // and one rate-limited refusal among them failed the entire payout.
  if (isPonsSession(tokenMint)) {
    const { tokenBalance } = await import('@/lib/pons/transfers')
    const { withRpcRetry } = await import('@/lib/evm/retry')
    const verified: PayableWinner[] = []
    for (const winner of winners) {
      const balance = await withRpcRetry(() =>
        tokenBalance(tokenMint, winner.wallet, config.tokenDecimals)
      )
      if (balance >= config.minTokenHolding) verified.push(winner)
    }
    return verified
  }

  const holders = await getTokenHolders(tokenMint, 500)
  const balanceByWallet = new Map<string, number>()
  for (const row of holders) {
    if (!row.isContract) {
      balanceByWallet.set(walletKey(row.wallet), row.balance / Math.pow(10, config.tokenDecimals))
    }
  }

  return winners.filter(winner => holderOwnsSessionToken(winner.wallet, balanceByWallet))
}

export async function assertPayoutTransferAllowed(input: {
  rank: number
  recipient: string
  amountSol: number
  walletSol: number
  allowedWinners: PayableWinner[]
  expectedWinnerAmounts: number[]
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { rank, recipient, amountSol, walletSol, allowedWinners, expectedWinnerAmounts } = input
  if (!Number.isFinite(amountSol) || amountSol <= 0 || !Number.isFinite(walletSol)) return { ok: false, reason: 'Invalid payout amount' }

  if (!isValidSolanaAddress(recipient)) {
    return { ok: false, reason: isPonsSession() ? 'Recipient is not a valid EVM address' : 'Recipient is not a valid address' }
  }

  // Dev fee (rank 0) — allowed to DEV_WALLET_ADDRESS even though that wallet cannot win prizes.
  if (rank === 0) {
    const dev = config.devWalletAddress?.trim()
    if (!dev || !isValidSolanaAddress(dev)) {
      return { ok: false, reason: 'Dev fee blocked — DEV_WALLET_ADDRESS is missing or invalid' }
    }
    if (walletKey(recipient) !== walletKey(dev)) {
      return { ok: false, reason: 'Dev fee recipient does not match DEV_WALLET_ADDRESS' }
    }
    const distributable = maxDistributableSol(walletSol)
    if (amountSol > distributable + 1e-9) {
      return {
        ok: false,
        reason: `Amount ${amountSol.toFixed(6)} SOL exceeds distributable cap ${distributable.toFixed(6)} SOL (reserve ${getMinWalletReserveSol()} SOL)`,
      }
    }
    return { ok: true }
  }

  if (isExcludedParticipantWallet(recipient)) {
    return { ok: false, reason: 'Recipient is an excluded protocol wallet' }
  }

  const distributable = maxDistributableSol(walletSol)
  if (amountSol > distributable + 1e-9) {
    return {
      ok: false,
      reason: `Amount ${amountSol.toFixed(6)} SOL exceeds distributable cap ${distributable.toFixed(6)} SOL (reserve ${getMinWalletReserveSol()} SOL)`,
    }
  }

  if (rank < 1 || rank > config.winnerCount) {
    return { ok: false, reason: `Invalid winner rank ${rank}` }
  }

  const winnerIndex = rank - 1
  const expected = allowedWinners[winnerIndex]
  if (!expected || walletKey(expected.wallet) !== walletKey(recipient)) {
    return {
      ok: false,
      reason: `Recipient ${recipient.slice(0, 8)}... is not live eligible winner #${rank}`,
    }
  }

  const expectedAmount = expectedWinnerAmounts[winnerIndex]
  if (expectedAmount != null && Math.abs(amountSol - expectedAmount) > 0.000001) {
    return {
      ok: false,
      reason: `Winner #${rank} amount mismatch (expected ${expectedAmount.toFixed(6)} SOL)`,
    }
  }

  if (!config.tokenMint) {
    return { ok: false, reason: 'Token mint not configured' }
  }

  const holders = await getTokenHolders(config.tokenMint, 500)
  const balanceByWallet = new Map<string, number>()
  for (const row of holders) {
    if (!row.isContract) {
      balanceByWallet.set(walletKey(row.wallet), row.balance / Math.pow(10, config.tokenDecimals))
    }
  }

  if (!holderOwnsSessionToken(recipient, balanceByWallet)) {
    return {
      ok: false,
      reason: 'Recipient does not hold the session token on-chain — payout blocked',
    }
  }

  return { ok: true }
}

export async function assertPayoutTokenTransferAllowed(input: {
  rank: number
  recipient: string
  amountTokens: number
  allowedWinners: PayableWinner[]
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { rank, recipient, amountTokens, allowedWinners } = input

  if (!isValidSolanaAddress(recipient)) {
    return { ok: false, reason: isPonsSession() ? 'Recipient is not a valid EVM address' : 'Recipient is not a valid address' }
  }

  if (isExcludedParticipantWallet(recipient)) {
    return { ok: false, reason: 'Recipient is an excluded protocol wallet' }
  }

  if (rank < 1 || rank > config.winnerCount) {
    return { ok: false, reason: `Invalid winner rank ${rank}` }
  }

  if (!Number.isFinite(amountTokens) || amountTokens <= 0) {
    return { ok: false, reason: 'Token payout amount must be greater than 0' }
  }

  const winnerIndex = rank - 1
  const expected = allowedWinners[winnerIndex]
  if (!expected || walletKey(expected.wallet) !== walletKey(recipient)) {
    return {
      ok: false,
      reason: `Recipient ${recipient.slice(0, 8)}... is not live eligible winner #${rank}`,
    }
  }

  if (!config.tokenMint) {
    return { ok: false, reason: 'Token mint not configured' }
  }

  const holders = await getTokenHolders(config.tokenMint, 500)
  const balanceByWallet = new Map<string, number>()
  for (const row of holders) {
    if (!row.isContract) {
      balanceByWallet.set(walletKey(row.wallet), row.balance / Math.pow(10, config.tokenDecimals))
    }
  }

  if (!holderOwnsSessionToken(recipient, balanceByWallet)) {
    return {
      ok: false,
      reason: 'Recipient does not hold the session token on-chain — payout blocked',
    }
  }

  return { ok: true }
}

/** Chain-neutral name for {@link isValidSolanaAddress}. */
export const isValidPayoutAddress = isValidSolanaAddress
