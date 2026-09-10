import 'server-only'

/**
 * Automatic Pons creator-fee collection — the Robinhood Chain replacement for
 * `lib/pump/collectCreatorFees.ts`.
 *
 * Pons credits creator fees to an escrow rather than pushing them, and exposes
 * the pending balance, so unlike the pump.fun path we can check what is
 * actually owed *before* spending gas. A launch priced in native ETH credits
 * the escrow's native ledger; a custom-pair launch credits the per-token
 * ledger under its quote asset.
 *
 * The claiming wallet must be the launch's `creatorFeeRecipient` — i.e. the
 * payout wallet the launcher registers with us.
 */

import { formatEther, formatUnits, isAddress, type Address } from 'viem'
import {
  ERC20_ABI,
  FEE_ESCROW_ABI,
  PONS_V2,
  accountForKey,
  isNativeAsset,
  publicClient,
  walletClientForKey,
} from './contracts'
import { getPonsLaunch } from './launch'

export interface PendingFees {
  /** Wei owed on the escrow's native (ETH) ledger. */
  nativeWei: bigint
  /** Owed on the quote asset's ledger, when the launch is not ETH-quoted. */
  tokenAmount: bigint
  tokenAddress: Address | null
  tokenDecimals: number
  /** True when the launch is ETH-quoted (the common case). */
  nativeQuote: boolean
}

export interface ClaimResult {
  success: boolean
  claimed: boolean
  txHash: string | null
  /** Human-readable amount claimed, in the asset that was claimed. */
  amount: number
  asset: string
  error: string | null
  skippedReason?: 'below_minimum' | 'nothing_owed' | 'not_pons' | 'no_key' | 'wrong_recipient'
}

/** Don't burn gas claiming dust. Override with PONS_MIN_CLAIM_ETH. */
export function minClaimWei(): bigint {
  const raw = parseFloat(process.env.PONS_MIN_CLAIM_ETH ?? '')
  const eth = Number.isFinite(raw) && raw >= 0 ? raw : 0.0005
  return BigInt(Math.floor(eth * 1e18))
}

/** Reads what the escrow currently owes a recipient for one launch. */
export async function getPendingFees(
  tokenAddress: string,
  recipient: string
): Promise<PendingFees | null> {
  if (!isAddress(tokenAddress) || !isAddress(recipient)) return null
  const launch = await getPonsLaunch(tokenAddress)
  if (!launch) return null

  const client = publicClient()
  const nativeWei = (await client.readContract({
    address: PONS_V2.feeEscrow,
    abi: FEE_ESCROW_ABI,
    functionName: 'balanceOf',
    args: [recipient as Address],
  })) as bigint

  if (launch.nativeQuote) {
    return {
      nativeWei,
      tokenAmount: 0n,
      tokenAddress: null,
      tokenDecimals: 18,
      nativeQuote: true,
    }
  }

  const [tokenAmount, decimals] = await Promise.all([
    client.readContract({
      address: PONS_V2.feeEscrow,
      abi: FEE_ESCROW_ABI,
      functionName: 'balanceOfToken',
      args: [recipient as Address, launch.pairToken],
    }) as Promise<bigint>,
    client
      .readContract({ address: launch.pairToken, abi: ERC20_ABI, functionName: 'decimals' })
      .then(d => Number(d))
      .catch(() => 18),
  ])

  return {
    nativeWei,
    tokenAmount,
    tokenAddress: launch.pairToken,
    tokenDecimals: decimals,
    nativeQuote: false,
  }
}

/**
 * Claim accrued creator fees into the payout wallet. Safe to call on every
 * cycle: it reads the pending balance first and no-ops below the minimum, so
 * a quiet listing costs one `eth_call` rather than a wasted transaction.
 */
export async function claimCreatorFees(input: {
  tokenAddress: string
  /** Payout wallet private key (hex) — must be the launch's creatorFeeRecipient. */
  privateKeyHex: string | undefined | null
  /** When false, report what *would* be claimed without sending a tx. */
  execute?: boolean
}): Promise<ClaimResult> {
  const base: ClaimResult = {
    success: false,
    claimed: false,
    txHash: null,
    amount: 0,
    asset: 'ETH',
    error: null,
  }

  const account = accountForKey(input.privateKeyHex)
  if (!account) {
    return { ...base, error: 'Payout wallet key missing or not a valid EVM key', skippedReason: 'no_key' }
  }

  const launch = await getPonsLaunch(input.tokenAddress)
  if (!launch) {
    return { ...base, success: true, error: null, skippedReason: 'not_pons' }
  }

  // Only the recorded recipient can claim; anything else would revert on-chain.
  if (launch.creatorFeeRecipient.toLowerCase() !== account.address.toLowerCase()) {
    return {
      ...base,
      error:
        `Payout wallet ${account.address} is not this launch's creator fee recipient ` +
        `(${launch.creatorFeeRecipient}) — fees cannot be claimed to it`,
      skippedReason: 'wrong_recipient',
    }
  }

  const pending = await getPendingFees(input.tokenAddress, account.address)
  if (!pending) return { ...base, error: 'Could not read pending fees' }

  const claimNative = pending.nativeQuote || pending.nativeWei > 0n
  const owed = claimNative ? pending.nativeWei : pending.tokenAmount
  const decimals = claimNative ? 18 : pending.tokenDecimals
  const asset = claimNative ? 'ETH' : (pending.tokenAddress ?? 'token')

  if (owed <= 0n) {
    return { ...base, success: true, asset, skippedReason: 'nothing_owed' }
  }
  // The dust floor is denominated in ETH; only meaningful for the native ledger.
  if (claimNative && owed < minClaimWei()) {
    return {
      ...base,
      success: true,
      asset,
      amount: Number(formatEther(owed)),
      skippedReason: 'below_minimum',
    }
  }

  const human = Number(formatUnits(owed, decimals))

  if (input.execute === false) {
    console.log(`[Pons] Dry run — would claim ${human} ${asset} for ${account.address.slice(0, 10)}…`)
    return { ...base, success: true, amount: human, asset }
  }

  const wallet = walletClientForKey(input.privateKeyHex)
  if (!wallet) return { ...base, error: 'Could not build wallet client', skippedReason: 'no_key' }

  try {
    const txHash = claimNative
      ? await wallet.writeContract({
          address: PONS_V2.feeEscrow,
          abi: FEE_ESCROW_ABI,
          functionName: 'claim',
          account,
          chain: wallet.chain,
        })
      : await wallet.writeContract({
          address: PONS_V2.feeEscrow,
          abi: FEE_ESCROW_ABI,
          functionName: 'claimToken',
          args: [pending.tokenAddress as Address],
          account,
          chain: wallet.chain,
        })

    const receipt = await publicClient().waitForTransactionReceipt({ hash: txHash, timeout: 60_000 })
    if (receipt.status !== 'success') {
      return { ...base, txHash, amount: human, asset, error: 'Claim transaction reverted' }
    }

    console.log(`[Pons] ✅ Claimed ${human} ${asset} creator fees — ${txHash}`)
    return { success: true, claimed: true, txHash, amount: human, asset, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Pons] Claim failed:', msg)
    return { ...base, error: msg, asset, amount: human }
  }
}

/** True when the mint is a Pons v2 launch we can service. */
export async function isPonsToken(tokenAddress: string): Promise<boolean> {
  return (await getPonsLaunch(tokenAddress)) !== null
}

/** Native-asset sentinel re-export for callers building UI labels. */
export { isNativeAsset }
