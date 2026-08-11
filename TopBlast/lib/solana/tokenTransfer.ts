import 'server-only'

import {
  Keypair,
  PublicKey,
  Transaction,
} from '@solana/web3.js'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import bs58 from 'bs58'
import { getPayoutPrivateKey } from '@/lib/tenant/context'
import { isPayoutExecutionAuthorized } from '@/lib/payout/payoutAuthContext'
import { getSolanaRpcUrl } from '@/lib/solana/rpcUrl'
import {
  confirmTransactionWithPolling,
  getLatestBlockhashHttp,
  jsonRpcCall,
  sendRawTransactionHttp,
} from '@/lib/solana/transfer'

export interface TokenTransferResult {
  success: boolean
  txHash: string | null
  error: string | null
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

function toRawAmount(humanAmount: number, decimals: number): bigint {
  const factor = Math.pow(10, decimals)
  return BigInt(Math.floor(humanAmount * factor))
}

async function resolveTokenProgramForMint(rpcUrl: string, mintPk: PublicKey): Promise<PublicKey> {
  try {
    const result = await jsonRpcCall(rpcUrl, 'getAccountInfo', [
      mintPk.toBase58(),
      { encoding: 'base64' },
    ])
    const owner = result?.value?.owner as string | undefined
    if (owner === TOKEN_2022_PROGRAM_ID.toBase58()) {
      return TOKEN_2022_PROGRAM_ID
    }
  } catch {
    /* default legacy SPL token */
  }
  return TOKEN_PROGRAM_ID
}

/** Human-readable session token balance in the payout wallet (0 if no ATA). */
export async function getPayoutWalletTokenBalance(
  mint: string,
  decimals: number
): Promise<number> {
  const payoutKeypair = loadPayoutKeypair()
  if (!payoutKeypair) return 0

  const rpcUrl = getSolanaRpcUrl()
  const mintPk = new PublicKey(mint)
  const tokenProgramId = await resolveTokenProgramForMint(rpcUrl, mintPk)
  const ata = getAssociatedTokenAddressSync(
    mintPk,
    payoutKeypair.publicKey,
    false,
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )

  try {
    const result = await jsonRpcCall(rpcUrl, 'getTokenAccountBalance', [ata.toBase58()])
    const amount = result?.value?.amount
    if (!amount) return 0
    return Number(amount) / Math.pow(10, decimals)
  } catch {
    return 0
  }
}

/**
 * Transfer session SPL tokens from the payout wallet to a winner.
 * Creates the recipient ATA if needed (payer = payout wallet).
 */
export async function transferSessionToken(
  recipientAddress: string,
  amountHuman: number,
  mint: string,
  decimals: number,
  symbol?: string
): Promise<TokenTransferResult> {
  if (!isPayoutExecutionAuthorized()) {
    return {
      success: false,
      txHash: null,
      error: 'Transfer blocked — not running inside authorized payout context',
    }
  }

  if (amountHuman <= 0) {
    return { success: false, txHash: null, error: 'Token amount must be greater than 0' }
  }

  const payoutKeypair = loadPayoutKeypair()
  if (!payoutKeypair) {
    return { success: false, txHash: null, error: 'PAYOUT_WALLET_PRIVATE_KEY not configured' }
  }

  let recipientPk: PublicKey
  let mintPk: PublicKey
  try {
    recipientPk = new PublicKey(recipientAddress)
    mintPk = new PublicKey(mint)
  } catch {
    return { success: false, txHash: null, error: 'Invalid recipient or mint address' }
  }

  const rawAmount = toRawAmount(amountHuman, decimals)
  if (rawAmount <= 0n) {
    return { success: false, txHash: null, error: 'Token amount too small after decimal conversion' }
  }

  try {
    const rpcUrl = getSolanaRpcUrl()
    const tokenProgramId = await resolveTokenProgramForMint(rpcUrl, mintPk)
    const sourceAta = getAssociatedTokenAddressSync(
      mintPk,
      payoutKeypair.publicKey,
      false,
      tokenProgramId,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
    const destAta = getAssociatedTokenAddressSync(
      mintPk,
      recipientPk,
      false,
      tokenProgramId,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )

    const transaction = new Transaction()
    transaction.add(
      createAssociatedTokenAccountIdempotentInstruction(
        payoutKeypair.publicKey,
        destAta,
        recipientPk,
        mintPk,
        tokenProgramId,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    )

    transaction.add(
      createTransferCheckedInstruction(
        sourceAta,
        mintPk,
        destAta,
        payoutKeypair.publicKey,
        rawAmount,
        decimals,
        [],
        tokenProgramId
      )
    )

    const label = symbol || 'token'
    console.log(
      `[TokenTransfer] Sending ${amountHuman.toFixed(4)} ${label} to ${recipientAddress.slice(0, 8)}...`
    )

    const { blockhash } = await getLatestBlockhashHttp(rpcUrl)
    transaction.recentBlockhash = blockhash
    transaction.feePayer = payoutKeypair.publicKey
    transaction.sign(payoutKeypair)

    const txHash = await sendRawTransactionHttp(transaction.serialize(), rpcUrl, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    })

    const confirmation = await confirmTransactionWithPolling(rpcUrl, txHash, 45, 1500)
    if (!confirmation.confirmed) {
      return {
        success: false,
        txHash,
        error: confirmation.error || 'Token transfer not confirmed',
      }
    }

    console.log(`[TokenTransfer] ✅ Confirmed: ${txHash}`)
    return { success: true, txHash, error: null }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[TokenTransfer] Failed:', message)
    return { success: false, txHash: null, error: message }
  }
}

/** Smallest human-readable amount that converts to 1 raw token unit. */
export function minHumanTokenTransfer(decimals: number): number {
  return 1 / Math.pow(10, decimals)
}

/** Poll RPC briefly — ATA balance can lag right after a Jupiter swap confirms. */
export async function getPayoutWalletTokenBalanceWithRetry(
  mint: string,
  decimals: number,
  options?: { attempts?: number; delayMs?: number }
): Promise<number> {
  const attempts = options?.attempts ?? 5
  const delayMs = options?.delayMs ?? 750
  let last = 0
  for (let i = 0; i < attempts; i++) {
    last = await getPayoutWalletTokenBalance(mint, decimals)
    if (last > 0) return last
    if (i < attempts - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  return last
}

/**
 * Prefer on-chain balance delta after swap; fall back to Jupiter quote output.
 */
export async function resolveSwapDeliveredTokens(input: {
  mint: string
  decimals: number
  preSwapBalance: number
  quotedOutputHuman: number | null
}): Promise<number> {
  const { mint, decimals, preSwapBalance, quotedOutputHuman } = input

  for (let attempt = 0; attempt < 5; attempt++) {
    const postBalance = await getPayoutWalletTokenBalance(mint, decimals)
    const delta = Math.max(0, postBalance - preSwapBalance)
    if (delta > 0) {
      if (
        quotedOutputHuman != null &&
        quotedOutputHuman > 0 &&
        Math.abs(delta - quotedOutputHuman) / quotedOutputHuman > 0.25
      ) {
        console.warn(
          `[Payout] Swap on-chain delta ${delta.toFixed(4)} differs from quote ${quotedOutputHuman.toFixed(4)} — using on-chain delta`
        )
      }
      return delta
    }
    if (attempt < 4) {
      await new Promise(resolve => setTimeout(resolve, 750))
    }
  }

  if (quotedOutputHuman != null && quotedOutputHuman > 0) {
    console.warn(
      `[Payout] Swap balance delta still 0 after polling — falling back to Jupiter quote (${quotedOutputHuman.toFixed(4)} tokens)`
    )
    return quotedOutputHuman
  }

  return 0
}

/** Split a token total across winners proportional to their SOL share (largest-remainder). */
export function allocateTokenAmountsBySolShare(
  entries: { rank: number; amountSol: number }[],
  totalTokensHuman: number
): Map<number, number> {
  const totalSol = entries.reduce((sum, e) => sum + e.amountSol, 0)
  const map = new Map<number, number>()
  if (totalSol <= 0 || totalTokensHuman <= 0 || entries.length === 0) return map

  if (entries.length === 1) {
    map.set(entries[0].rank, totalTokensHuman)
    return map
  }

  const scale = 1e6
  const scaledTotal = Math.floor(totalTokensHuman * scale)
  if (scaledTotal <= 0) return map

  const shares = entries.map(entry => {
    const exact = (entry.amountSol / totalSol) * scaledTotal
    const floored = Math.floor(exact)
    return {
      rank: entry.rank,
      floored,
      remainder: exact - floored,
    }
  })

  let assigned = shares.reduce((sum, share) => sum + share.floored, 0)
  let leftover = scaledTotal - assigned

  shares.sort((a, b) => b.remainder - a.remainder)
  for (let i = 0; i < leftover && i < shares.length; i++) {
    shares[i].floored += 1
  }

  for (const share of shares) {
    map.set(share.rank, share.floored / scale)
  }

  return map
}
