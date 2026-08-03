/**
 * Native ETH transfers on Robinhood Chain
 * Replaces Solana SOL transfers — uses viem (same pattern as waddlebet EvmCustodialWalletService)
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  parseEther,
  isAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { getChainConfig, getEvmRpcUrl } from './chain'

const MIN_TRANSFER_ETH = 0.001

function getAccount() {
  const key = process.env.PAYOUT_WALLET_PRIVATE_KEY
  if (!key) return null
  // EVM keys are 64-char hex (optional 0x prefix). Skip Solana base58 keys.
  const hexBody = key.startsWith('0x') ? key.slice(2) : key
  if (!/^[0-9a-fA-F]{64}$/.test(hexBody)) {
    console.warn('[Transfer] PAYOUT_WALLET_PRIVATE_KEY is not a valid EVM hex key')
    return null
  }
  const normalized = key.startsWith('0x') ? key : `0x${key}`
  return privateKeyToAccount(normalized as `0x${string}`)
}

function getPublicClient() {
  return createPublicClient({
    chain: getChainConfig() as any,
    transport: http(getEvmRpcUrl()),
  })
}

function getWalletClient() {
  const account = getAccount()
  if (!account) return null
  return createWalletClient({
    account,
    chain: getChainConfig() as any,
    transport: http(getEvmRpcUrl()),
  })
}

export async function transferEth(
  recipientAddress: string,
  amountEth: number
): Promise<{ success: boolean; txHash: string | null; error: string | null }> {
  if (!process.env.PAYOUT_WALLET_PRIVATE_KEY) {
    return { success: false, txHash: null, error: 'PAYOUT_WALLET_PRIVATE_KEY not configured' }
  }

  if (amountEth <= 0) {
    return { success: false, txHash: null, error: 'Amount must be greater than 0' }
  }

  if (amountEth < MIN_TRANSFER_ETH) {
    return {
      success: false,
      txHash: null,
      error: `Amount ${amountEth.toFixed(6)} ETH below minimum ${MIN_TRANSFER_ETH} ETH`,
    }
  }

  if (!isAddress(recipientAddress)) {
    return { success: false, txHash: null, error: 'Invalid recipient address' }
  }

  const account = getAccount()
  const walletClient = getWalletClient()
  const publicClient = getPublicClient()
  if (!account || !walletClient) {
    return { success: false, txHash: null, error: 'Invalid payout wallet key' }
  }

  try {
    console.log(`[Transfer] Network: Robinhood Chain (${getChainConfig().id})`)
    console.log(`[Transfer] From: ${account.address.slice(0, 10)}...`)
    console.log(`[Transfer] To: ${recipientAddress.slice(0, 10)}...`)
    console.log(`[Transfer] Amount: ${amountEth} ETH`)

    const balance = await publicClient.getBalance({ address: account.address })
    const amountWei = parseEther(amountEth.toString())
    const feeBuffer = parseEther('0.001')

    if (balance < amountWei + feeBuffer) {
      return {
        success: false,
        txHash: null,
        error: `Insufficient balance. Have: ${formatUnits(balance, 18)} ETH, Need: ${amountEth} ETH + fee`,
      }
    }

    const txHash = await walletClient.sendTransaction({
      to: recipientAddress as `0x${string}`,
      value: amountWei,
    })

    console.log(`[Transfer] Transaction sent: ${txHash}`)
    console.log(`[Transfer] Waiting for confirmation...`)

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    })

    if (receipt.status === 'success') {
      console.log(`[Transfer] ✅ Confirmed: ${txHash}`)
      return { success: true, txHash, error: null }
    }

    return { success: false, txHash, error: 'Transaction reverted' }
  } catch (error: any) {
    console.error('[Transfer] ❌ Failed:', error.message)
    return { success: false, txHash: null, error: error.message || 'Transfer failed' }
  }
}

/** @deprecated alias */
export const transferSol = transferEth

export async function getPayoutWalletBalance(): Promise<{
  sol: number
  eth: number
  address: string
} | null> {
  const account = getAccount()
  if (!account) return null

  try {
    const publicClient = getPublicClient()
    const balance = await publicClient.getBalance({ address: account.address })
    const eth = parseFloat(formatUnits(balance, 18))
    return { sol: eth, eth, address: account.address }
  } catch (error) {
    console.error('[Transfer] Failed to get wallet balance:', error)
    return null
  }
}

export async function verifyConnection(): Promise<{
  connected: boolean
  network: string
  blockHeight: number | null
}> {
  try {
    const publicClient = getPublicClient()
    const blockHeight = Number(await publicClient.getBlockNumber())
    return {
      connected: true,
      network: `robinhood-${getChainConfig().id}`,
      blockHeight,
    }
  } catch {
    return {
      connected: false,
      network: `robinhood-${getChainConfig().id}`,
      blockHeight: null,
    }
  }
}
