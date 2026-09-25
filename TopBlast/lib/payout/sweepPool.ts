import { formatEther, parseEther, type Address } from 'viem'
import { config } from '@/lib/config'
import { getTenantSlug } from '@/lib/tenant/context'
import { requirePlatformDevWalletAddress } from '@/lib/platform/devWallet'
import { isEvmAddress } from '@/lib/pons/session'

/**
 * Operator sweep: send a listing's whole pool to the dev wallet instead of
 * running its cycle.
 *
 * Switched on per listing with SWEEP_POOLS_TO_DEV="blasty,pve" (or "all").
 * It runs inside the worker's authorized payout context, so the same signing
 * path that pays winners does the send — nothing is decrypted anywhere else.
 * While the flag names a listing, that listing pays no cycles; remove the
 * flag afterwards and cycles resume on the next tick.
 */

export type SweepResult =
  | { swept: false; reason: string }
  | { swept: true; wallet: string; amountEth: number; txHash: string | null }

export function sweepRequestedFor(slug: string): boolean {
  const raw = (process.env.SWEEP_POOLS_TO_DEV ?? '').trim().toLowerCase()
  if (!raw) return false
  const list = raw.split(',').map(s => s.trim()).filter(Boolean)
  return list.includes('all') || list.includes(slug.toLowerCase())
}

export async function sweepPoolToDev(): Promise<SweepResult> {
  const slug = getTenantSlug()
  const destination = requirePlatformDevWalletAddress()
  if (!isEvmAddress(destination)) return { swept: false, reason: 'DEV_WALLET_ADDRESS is not an EVM address' }

  const { getPayoutWalletAddress, getWalletBalance, transfer } = await import('@/lib/pons/transfers')
  const { publicClient } = await import('@/lib/pons/contracts')

  const wallet = getPayoutWalletAddress()
  if (!wallet) return { swept: false, reason: 'No EVM payout wallet for this listing' }
  if (wallet.toLowerCase() === destination.toLowerCase()) {
    return { swept: false, reason: 'Payout wallet is already the dev wallet' }
  }

  const bal = await getWalletBalance(wallet)
  if (!bal || bal.rpcError) return { swept: false, reason: `Balance read failed: ${bal?.rpcError ?? 'unknown'}` }

  // Keep enough for this one send, with headroom for fee movement. The chain
  // adds an L1 data component to estimateGas, so use that rather than 21000.
  const client = publicClient()
  const [gas, fees] = await Promise.all([
    client.estimateGas({ account: wallet as Address, to: destination as Address, value: 1n }),
    client.estimateFeesPerGas(),
  ])
  const perGas = fees.maxFeePerGas ?? fees.gasPrice ?? 0n
  const reserveWei = (gas * perGas * 3n) / 2n
  const sweepWei = parseEther(bal.sol.toFixed(18)) - reserveWei
  if (sweepWei <= 0n) return { swept: false, reason: `Pool ${bal.sol} ETH does not cover gas` }

  const amountEth = Number(formatEther(sweepWei))
  console.log(`[Sweep] ${slug}: sending ${amountEth} ETH from ${wallet} to dev wallet ${destination}`)
  const result = await transfer(destination, amountEth)
  if (!result.success) {
    console.error(`[Sweep] ${slug} failed: ${result.error}`)
    return { swept: false, reason: result.error ?? 'transfer failed' }
  }
  console.log(`[Sweep] ${slug}: sent ${amountEth} ETH (${result.txHash})`)
  return { swept: true, wallet, amountEth, txHash: result.txHash }
}

/** True when this listing is flagged for sweeping, whatever `config` says about payouts. */
export function sweepActiveForCurrentTenant(): boolean {
  return Boolean(config.tokenMint) && sweepRequestedFor(getTenantSlug())
}
