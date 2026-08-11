import 'server-only'

import axios from 'axios'
import { Keypair, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import bs58 from 'bs58'
import { getPayoutSwapMaxRetries } from '@/lib/payout/payoutRetry'
import { getPayoutPrivateKey } from '@/lib/tenant/context'
import { isPayoutExecutionAuthorized } from '@/lib/payout/payoutAuthContext'
import { getSolanaRpcUrl } from '@/lib/solana/rpcUrl'
import {
  confirmTransactionWithPolling,
  sendRawTransactionHttp,
} from '@/lib/solana/transfer'

/** Wrapped/native SOL mint used by Jupiter routes. */
export const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112'

/** Jupiter consolidated gateway (quote-api.jup.ag/v6 was sunset Aug 2025). */
const JUPITER_QUOTE_URL = 'https://api.jup.ag/swap/v1/quote'
const JUPITER_SWAP_URL = 'https://api.jup.ag/swap/v1/swap'

function getJupiterRequestHeaders(): Record<string, string> {
  const apiKey = process.env.JUPITER_API_KEY?.trim()
  return apiKey ? { 'x-api-key': apiKey } : {}
}

export function getPayoutSwapSlippageBps(): number {
  const raw = parseInt(process.env.PAYOUT_SWAP_SLIPPAGE_BPS || '150', 10)
  return Number.isFinite(raw) && raw >= 0 && raw <= 5000 ? raw : 150
}

/** Escalating slippage steps for swap retries (deduped, capped at 1000 bps). */
export function getPayoutSwapSlippageSteps(): number[] {
  const base = getPayoutSwapSlippageBps()
  const maxRetries = getPayoutSwapMaxRetries()
  const steps: number[] = []
  for (let i = 0; i < maxRetries; i++) {
    const step = Math.min(1000, Math.round(base * (i + 1)))
    if (!steps.includes(step)) steps.push(step)
  }
  return steps.length > 0 ? steps : [base]
}

/** When false, winners are paid in SOL (legacy). Default: buy session token then pay winners. */
export function isNativeTokenPayoutEnabled(): boolean {
  const raw = process.env.PAYOUT_AS_NATIVE_TOKEN?.trim().toLowerCase()
  if (raw === 'false' || raw === '0') return false
  return true
}

export interface SwapSolForTokenResult {
  success: boolean
  txHash: string | null
  error: string | null
  /** Output amount in smallest token units (from quote). */
  outputAmountRaw: string | null
  outputAmountHuman: number | null
  slippageBpsUsed?: number
  attempts?: number
}

interface JupiterQuoteResponse {
  outAmount?: string
  error?: string
}

interface JupiterSwapResponse {
  swapTransaction?: string
  error?: string
}

function loadPayoutKeypair(): Keypair | null {
  const privateKey = getPayoutPrivateKey()
  if (!privateKey) return null
  try {
    return Keypair.fromSecretKey(bs58.decode(privateKey.trim()))
  } catch {
    return null
  }
}

async function swapSolForTokenOnce(
  amountSol: number,
  outputMint: string,
  tokenDecimals: number,
  slippageBps: number
): Promise<SwapSolForTokenResult> {
  const empty: SwapSolForTokenResult = {
    success: false,
    txHash: null,
    error: null,
    outputAmountRaw: null,
    outputAmountHuman: null,
    slippageBpsUsed: slippageBps,
  }

  const payoutKeypair = loadPayoutKeypair()
  if (!payoutKeypair) {
    return { ...empty, error: 'PAYOUT_WALLET_PRIVATE_KEY not configured' }
  }

  const inputMint = NATIVE_SOL_MINT
  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL)
  if (lamports <= 0) {
    return { ...empty, error: 'Swap amount too small after lamport conversion' }
  }

  console.log(
    `[Jupiter] Quote: ${amountSol.toFixed(6)} SOL → ${outputMint.slice(0, 8)}... (slippage ${slippageBps} bps)`
  )

  const quoteResponse = await axios.get<JupiterQuoteResponse>(JUPITER_QUOTE_URL, {
    params: {
      inputMint,
      outputMint: outputMint.trim(),
      amount: String(lamports),
      slippageBps,
      swapMode: 'ExactIn',
    },
    headers: getJupiterRequestHeaders(),
    timeout: 20000,
  })

  const quote = quoteResponse.data
  if (!quote?.outAmount) {
    const err = quote?.error || 'Jupiter returned no route for this token'
    console.error(`[Jupiter] Quote failed: ${err}`)
    return { ...empty, error: err }
  }

  const swapBuild = await axios.post<JupiterSwapResponse>(
    JUPITER_SWAP_URL,
    {
      quoteResponse: quote,
      userPublicKey: payoutKeypair.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    },
    { headers: getJupiterRequestHeaders(), timeout: 20000 }
  )

  const swapTxBase64 = swapBuild.data?.swapTransaction
  if (!swapTxBase64) {
    const err = swapBuild.data?.error || 'Jupiter swap build failed'
    console.error(`[Jupiter] Swap build failed: ${err}`)
    return { ...empty, error: err }
  }

  const rpcUrl = getSolanaRpcUrl()
  const tx = VersionedTransaction.deserialize(Buffer.from(swapTxBase64, 'base64'))
  tx.sign([payoutKeypair])

  console.log('[Jupiter] Sending swap transaction...')
  const txHash = await sendRawTransactionHttp(tx.serialize(), rpcUrl, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })

  const confirmation = await confirmTransactionWithPolling(rpcUrl, txHash, 45, 1500)
  if (!confirmation.confirmed) {
    console.error(`[Jupiter] Swap not confirmed: ${confirmation.error}`)
    return {
      ...empty,
      txHash,
      error: confirmation.error || 'Swap transaction not confirmed',
    }
  }

  const outputAmountRaw = quote.outAmount
  const outputAmountHuman =
    Number(BigInt(outputAmountRaw)) / Math.pow(10, tokenDecimals)

  console.log(
    `[Jupiter] ✅ Swap confirmed ${txHash} — ~${outputAmountHuman.toFixed(4)} tokens received (quoted)`
  )

  return {
    success: true,
    txHash,
    error: null,
    outputAmountRaw,
    outputAmountHuman,
    slippageBpsUsed: slippageBps,
  }
}

/**
 * Swap SOL from the payout wallet into the tenant session token via Jupiter.
 * Retries with escalating slippage when routes fail or txs don't confirm.
 */
export async function swapSolForToken(
  amountSol: number,
  outputMint: string,
  tokenDecimals: number
): Promise<SwapSolForTokenResult> {
  const empty: SwapSolForTokenResult = {
    success: false,
    txHash: null,
    error: null,
    outputAmountRaw: null,
    outputAmountHuman: null,
  }

  if (!isPayoutExecutionAuthorized()) {
    return { ...empty, error: 'Swap blocked — not running inside authorized payout context' }
  }

  if (amountSol <= 0) {
    return { ...empty, error: 'Swap amount must be greater than 0' }
  }

  const slippageSteps = getPayoutSwapSlippageSteps()
  let lastError = 'Token swap failed'
  let lastTxHash: string | null = null

  for (let attempt = 0; attempt < slippageSteps.length; attempt++) {
    const slippageBps = slippageSteps[attempt]
    if (attempt > 0) {
      console.log(
        `[Jupiter] Retry ${attempt + 1}/${slippageSteps.length} with slippage ${slippageBps} bps`
      )
    }

    try {
      const result = await swapSolForTokenOnce(
        amountSol,
        outputMint,
        tokenDecimals,
        slippageBps
      )
      if (result.success) {
        return { ...result, attempts: attempt + 1 }
      }
      lastError = result.error || lastError
      lastTxHash = result.txHash
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : String(error)
      console.error(`[Jupiter] Swap attempt ${attempt + 1} failed:`, lastError)
    }
  }

  const summary =
    slippageSteps.length > 1
      ? `Token swap failed after ${slippageSteps.length} attempts (up to ${slippageSteps[slippageSteps.length - 1]} bps slippage): ${lastError}`
      : lastError

  return {
    ...empty,
    txHash: lastTxHash,
    error: summary,
    attempts: slippageSteps.length,
  }
}
