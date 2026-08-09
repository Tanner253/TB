import 'server-only'

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import bs58 from 'bs58'
import BN from 'bn.js'
import {
  OnlinePumpSdk,
  feeSharingConfigPda,
} from '@pump-fun/pump-sdk'
import { getSolanaRpcUrl } from '@/lib/solana/rpcUrl'
import { getSolPrice } from '@/lib/solana/price'
import {
  confirmTransactionWithPolling,
  getLatestBlockhashHttp,
  sendRawTransactionHttp,
} from '@/lib/solana/transfer'
import { isPayoutExecutionAuthorized } from '@/lib/payout/payoutAuthContext'
import { minPumpCollectUsd } from '@/lib/pump/config'

export type PumpCollectResult =
  | { status: 'skipped'; reason: string }
  | { status: 'below_threshold'; pendingSol: number; pendingUsd: number; minUsd: number }
  | { status: 'collected'; signature: string; collectedSol: number; collectedUsd: number }
  | { status: 'error'; error: string }

function lamportsToSol(lamports: BN | number): number {
  const n = typeof lamports === 'number' ? lamports : lamports.toNumber()
  return n / LAMPORTS_PER_SOL
}

function loadCreatorKeypair(privateKey: string, expectedCreator: string): Keypair | null {
  try {
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey.trim()))
    if (keypair.publicKey.toBase58() !== expectedCreator) {
      return null
    }
    return keypair
  } catch {
    return null
  }
}

async function getPendingCreatorFeesLamports(
  sdk: OnlinePumpSdk,
  connection: Connection,
  mint: PublicKey,
  creator: PublicKey
): Promise<{ lamports: BN; mode: 'simple' | 'sharing' }> {
  const sharingConfig = feeSharingConfigPda(mint)
  const sharingInfo = await connection.getAccountInfo(sharingConfig)

  if (sharingInfo) {
    const feeInfo = await sdk.getMinimumDistributableFee(mint, creator)
    return { lamports: feeInfo.distributableFees, mode: 'sharing' }
  }

  const balance = await sdk.getCreatorVaultBalanceBothPrograms(creator)
  return { lamports: balance, mode: 'simple' }
}

async function buildCollectInstructions(
  sdk: OnlinePumpSdk,
  connection: Connection,
  mint: PublicKey,
  creator: PublicKey
) {
  const sharingConfig = feeSharingConfigPda(mint)
  const sharingInfo = await connection.getAccountInfo(sharingConfig)

  if (sharingInfo) {
    const { instructions } = await sdk.buildDistributeCreatorFeesInstructions(mint)
    return instructions
  }

  return sdk.collectCoinCreatorFeeInstructions(creator, creator)
}

/**
 * Collect Pump.fun creator fees into the tenant payout wallet when pending fees exceed the USD minimum.
 * Permissionless on-chain; payout wallet signs and pays tx fee.
 */
export async function collectPumpCreatorFeesIfDue(input: {
  mint: string
  creatorWallet: string
  privateKey: string
}): Promise<PumpCollectResult> {
  if (!isPayoutExecutionAuthorized()) {
    return { status: 'skipped', reason: 'Wallet signing not authorized in this context' }
  }

  const mint = input.mint.trim()
  const creatorWallet = input.creatorWallet.trim()
  if (!mint || !creatorWallet) {
    return { status: 'skipped', reason: 'Missing mint or creator wallet' }
  }

  const keypair = loadCreatorKeypair(input.privateKey, creatorWallet)
  if (!keypair) {
    return {
      status: 'skipped',
      reason: 'Payout private key does not match creator wallet (Pump creator fees require the same wallet)',
    }
  }

  let mintPk: PublicKey
  try {
    mintPk = new PublicKey(mint)
  } catch {
    return { status: 'skipped', reason: 'Invalid token mint' }
  }

  const rpcUrl = getSolanaRpcUrl()
  const connection = new Connection(rpcUrl, { commitment: 'confirmed', disableRetryOnRateLimit: false })
  const sdk = new OnlinePumpSdk(connection)

  try {
    const bondingCurve = await sdk.fetchBondingCurve(mintPk)
    if (bondingCurve.creator.toBase58() !== creatorWallet) {
      return {
        status: 'skipped',
        reason: 'Payout wallet is not the Pump bonding-curve creator for this mint',
      }
    }
  } catch {
    return { status: 'skipped', reason: 'Not a Pump.fun token (bonding curve not found)' }
  }

  const { lamports: pendingLamports, mode } = await getPendingCreatorFeesLamports(
    sdk,
    connection,
    mintPk,
    keypair.publicKey
  )

  if (pendingLamports.isZero()) {
    return { status: 'below_threshold', pendingSol: 0, pendingUsd: 0, minUsd: minPumpCollectUsd() }
  }

  const pendingSol = lamportsToSol(pendingLamports)
  const solPrice = (await getSolPrice()) || 0
  if (solPrice <= 0) {
    return { status: 'error', error: 'SOL price unavailable — cannot evaluate Pump collect threshold' }
  }

  const pendingUsd = pendingSol * solPrice
  const minUsd = minPumpCollectUsd()
  if (pendingUsd < minUsd) {
    return { status: 'below_threshold', pendingSol, pendingUsd, minUsd }
  }

  const instructions = await buildCollectInstructions(sdk, connection, mintPk, keypair.publicKey)
  if (!instructions.length) {
    return { status: 'skipped', reason: 'No Pump collect instructions returned' }
  }

  const { blockhash } = await getLatestBlockhashHttp(rpcUrl)
  const tx = new Transaction()
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }))
  tx.add(...instructions)
  tx.feePayer = keypair.publicKey
  tx.recentBlockhash = blockhash
  tx.sign(keypair)

  const signature = await sendRawTransactionHttp(tx.serialize(), rpcUrl, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })

  const confirmation = await confirmTransactionWithPolling(rpcUrl, signature, 45, 1000)
  if (!confirmation.confirmed) {
    return {
      status: 'error',
      error: confirmation.error || 'Pump creator fee collect tx not confirmed',
    }
  }

  console.log(
    `[PumpCollect] Collected ~${pendingSol.toFixed(6)} SOL (~$${pendingUsd.toFixed(2)}) for ${creatorWallet.slice(0, 8)}... (${mode}) tx=${signature.slice(0, 16)}...`
  )

  return {
    status: 'collected',
    signature,
    collectedSol: pendingSol,
    collectedUsd: pendingUsd,
  }
}
