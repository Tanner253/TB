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
export async function getWalletBalance(address: string) {
  if (!isEvmAddress(address)) return null
  try { return { sol: Number(formatEther(await publicClient().getBalance({ address: address as Address }))), address } }
  catch { return { sol: 0, address, rpcError: 'Could not read Robinhood balance' } }
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
      const value = parseUnits(amount.toFixed(Math.min(decimals, 18)), decimals)
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
  } catch {
    return { ...base, txHash: hash ?? null, error: hash ? 'Transaction submitted; confirmation unknown. Reconcile before retrying.' : 'EVM transfer failed before submission' }
  }
}
