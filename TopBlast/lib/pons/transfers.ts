import { submitOnce } from './submissions'
import 'server-only'
import { formatEther, formatUnits, parseEther, parseUnits, type Address, type Hash } from 'viem'
import { config } from '@/lib/config'
import { getPayoutPrivateKey } from '@/lib/tenant/context'
import { isPayoutExecutionAuthorized } from '@/lib/payout/payoutAuthContext'
import { accountForKey, publicClient, walletClientForKey, ERC20_ABI } from './contracts'
import { isEvmAddress } from './session'

export function signingAllowed(): boolean {
  return process.env.EXECUTE_PAYOUTS === 'true' && config.executePayouts && isPayoutExecutionAuthorized()
}
export function getPayoutWalletAddress(): string | null {
  return accountForKey(getPayoutPrivateKey())?.address.toLowerCase() ?? null
}
/**
 * Native balance, retried.
 *
 * The Robinhood RPC rate-limits hard and drops roughly one call in four under
 * load. A single attempt meant a momentary refusal was reported as a balance,
 * and a zero balance is indistinguishable from an empty pool: payouts were
 * skipped on a wallet that plainly held funds. The Solana path has always
 * retried across endpoints; this one had one shot.
 *
 * Failure still returns rpcError so callers can tell "unknown" from "empty" —
 * that distinction is what stops a flaky read from pausing a payout.
 */
export async function getWalletBalance(address: string) {
  if (!isEvmAddress(address)) return null
  let lastError = 'Could not read Robinhood balance'
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const wei = await publicClient().getBalance({ address: address as Address })
      return { sol: Number(formatEther(wei)), address }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      // Brief, widening backoff — the failures are rate limits, not outages.
      if (attempt < 2) await new Promise(r => setTimeout(r, 150 * (attempt + 1)))
    }
  }
  console.warn(`[Pons] Balance read failed for ${address.slice(0, 10)}… after 3 attempts: ${lastError}`)
  return { sol: 0, address, rpcError: lastError }
}
export async function tokenBalance(mint: string, wallet: string, decimals: number): Promise<number> {
  if (!isEvmAddress(mint) || !isEvmAddress(wallet)) throw new Error('Invalid EVM address')
  const raw = await publicClient().readContract({ address: mint as Address, abi: ERC20_ABI, functionName: 'balanceOf', args: [wallet as Address] })
  return Number(formatUnits(raw, decimals))
}
export async function transfer(recipient: string, amount: number, mint?: string, decimals = 18) {
  const base = { success: false, txHash: null as string | null, error: null as string | null }
  if (!signingAllowed()) return { ...base, error: 'Payout signing disabled or unauthorized' }
  if (!isEvmAddress(recipient) || !Number.isFinite(amount) || amount <= 0) return { ...base, error: 'Invalid recipient or amount' }
  const wallet = walletClientForKey(getPayoutPrivateKey())
  if (!wallet) return { ...base, error: 'Invalid EVM payout key' }
  let hash: Hash | undefined
  try {
    if (mint) {
      if (!isEvmAddress(mint)) throw new Error('Invalid token address')
      const requested = parseUnits(amount.toFixed(Math.min(decimals, 18)), decimals)
      // Amounts arrive as JS floats, and float -> toFixed(18) -> wei can land a
      // few hundred million wei ABOVE what the wallet holds — measured
      // 232,069,109 over on a 32.3M-token airdrop, which reverted with
      // insufficient balance and failed the whole payout. Never ask for more
      // than the wallet has.
      const held = (await publicClient().readContract({ address: mint as Address, abi: ERC20_ABI,
        functionName: 'balanceOf', args: [wallet.account.address] })) as bigint
      const value = requested > held ? held : requested
      if (value <= 0n) throw new Error('Amount rounds to zero')
      const { request, result } = await publicClient().simulateContract({ address: mint as Address, abi: ERC20_ABI,
        functionName: 'transfer', args: [recipient as Address, value], account: wallet.account })
      if (!result) throw new Error('Token transfer returned false')
      hash = await submitOnce('token:' + recipient.toLowerCase(), mint.toLowerCase() + ':' + value.toString(), () => wallet.writeContract(request))
    } else {
      const value = parseEther(amount.toFixed(18))
      if (value <= 0n) throw new Error('Amount rounds to zero')
      const gas = await publicClient().estimateGas({ account: wallet.account, to: recipient as Address, value })
      hash = await submitOnce('native:' + recipient.toLowerCase(), value.toString(), () => wallet.sendTransaction({ to: recipient as Address, value, gas }))
    }
    const receipt = await publicClient().waitForTransactionReceipt({ hash })
    return { success: receipt.status === 'success', txHash: hash, error: receipt.status === 'success' ? null : 'Transaction reverted' }
  } catch (err) {
    // Keep the cause. A bare "failed before submission" hid an
    // insufficient-balance revert for hours.
    const cause = (err as { shortMessage?: string })?.shortMessage ?? (err instanceof Error ? err.message : String(err))
    console.error('[Pons] transfer failed:', cause)
    return { ...base, txHash: hash ?? null, error: hash
      ? 'Transaction submitted; confirmation unknown. Reconcile before retrying.'
      : `EVM transfer failed before submission: ${cause.split(String.fromCharCode(10))[0].slice(0, 200)}` }
  }
}
