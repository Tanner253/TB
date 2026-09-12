import 'server-only'

/**
 * The flywheel, automated: half the protocol fee buys the platform token and
 * burns it, every cycle, without anyone pressing a button.
 *
 * Three properties this is built around, in priority order:
 *
 *  1. IT CAN NEVER COST A WINNER A PAYOUT. This runs only after winners are
 *     paid, and a failure here returns the ETH to the ops share rather than
 *     stranding it. The worst case is "no buyback this cycle", never "someone
 *     did not get paid".
 *
 *  2. IT BURNS FOR REAL. Every Pons token is the same ERC20Burnable
 *     implementation and exposes `burn(uint256)` (verified on-chain across
 *     several launches), so supply actually drops and anyone can confirm it
 *     against `totalSupply`. Sending to the zero address was the alternative
 *     and it would revert — these tokens carry OpenZeppelin's
 *     ERC20InvalidReceiver guard.
 *
 *  3. IT ONLY CLAIMS WHAT HAPPENED. The buy and the burn are separate
 *     transactions, so a cycle can legitimately end up bought-but-not-burned.
 *     That is recorded as exactly that, and the public flywheel numbers count
 *     burned tokens only from confirmed burns.
 *
 * Off unless FLYWHEEL_AUTO_BUYBACK=true. This spends real money on a path
 * that, until the platform token exists and one cycle has run clean, has
 * never executed — so it does not switch itself on.
 */

import { formatUnits, parseAbi, type Address } from 'viem'
import connectDB from '@/lib/db'
import mongoose from 'mongoose'
import { getChainId, publicClient, walletClientForKey } from '@/lib/pons/contracts'
import { accountForKey } from '@/lib/pons/keys'
import { buybackSessionToken } from '@/lib/pons/buyback'
import { isPonsSession } from '@/lib/pons/session'
import { getPlatformTokenMint } from '@/lib/platform/config'
import { DEV_FEE_BUYBACK_SHARE_PCT } from '@/lib/platform/flywheel'

const BURNABLE_ABI = parseAbi(['function burn(uint256 value)'])

export const FLYWHEEL_BUYBACKS_COLLECTION = 'platform_buybacks'

export function autoBuybackEnabled(): boolean {
  return process.env.FLYWHEEL_AUTO_BUYBACK?.trim().toLowerCase() === 'true'
}

/** Share of a cycle's protocol fee that buys and burns the platform token. */
export function buybackShareOfFee(totalFee: number): { buyback: number; ops: number } {
  const buyback = (totalFee * DEV_FEE_BUYBACK_SHARE_PCT) / 100
  return { buyback, ops: totalFee - buyback }
}

export interface FlywheelResult {
  attempted: boolean
  bought: boolean
  burned: boolean
  spentEth: number
  tokensBurned: number
  buyTxHash: string | null
  burnTxHash: string | null
  /** Set when nothing was spent — the caller returns this to the ops share. */
  error: string | null
}

const IDLE: FlywheelResult = {
  attempted: false,
  bought: false,
  burned: false,
  spentEth: 0,
  tokensBurned: 0,
  buyTxHash: null,
  burnTxHash: null,
  error: null,
}

/**
 * Buys the platform token with `quoteInWei` and burns everything received.
 *
 * Returns `attempted: false` with no error when the flywheel is simply not
 * configured — that is not a failure, and the caller treats the share as ops
 * spend either way.
 */
export async function buybackAndBurnPlatformToken(input: {
  quoteInWei: bigint
  privateKeyHex: string | undefined | null
  tenantSlug: string
  cycle: number
  execute: boolean
}): Promise<FlywheelResult> {
  if (!autoBuybackEnabled()) return IDLE
  if (input.quoteInWei <= 0n) return IDLE

  const platformToken = getPlatformTokenMint()?.trim()
  if (!platformToken) return { ...IDLE, error: 'No platform token configured' }
  if (!isPonsSession(platformToken)) {
    return { ...IDLE, error: 'Platform token is not on this chain' }
  }

  const account = accountForKey(input.privateKeyHex)
  if (!account) return { ...IDLE, error: 'Invalid payout key' }

  // Reuses the session buyback so phase routing, local quoting, v4
  // simulation and the idempotency journal all behave identically. The
  // journal label MUST differ from the session buy in the same cycle.
  const buy = await buybackSessionToken({
    tokenAddress: platformToken,
    quoteInWei: input.quoteInWei,
    privateKeyHex: input.privateKeyHex,
    tokenDecimals: 18,
    execute: input.execute,
    journalAction: 'flywheel-buyback',
  })

  const spentEth = Number(formatUnits(input.quoteInWei, 18))

  if (!buy.success) {
    return { ...IDLE, attempted: true, error: buy.error ?? 'Platform buyback failed' }
  }

  // Dry run: the quote proved a route exists, nothing was signed.
  if (!input.execute) {
    return { ...IDLE, attempted: true, bought: true, spentEth, error: null }
  }

  const boughtRaw = BigInt(buy.tokensOutRaw ?? '0')
  if (boughtRaw <= 0n) {
    return {
      ...IDLE,
      attempted: true,
      bought: true,
      spentEth,
      buyTxHash: buy.txHash,
      error: 'Buy confirmed but reported no tokens; skipping burn',
    }
  }

  const result: FlywheelResult = {
    attempted: true,
    bought: true,
    burned: false,
    spentEth,
    tokensBurned: 0,
    buyTxHash: buy.txHash,
    burnTxHash: null,
    error: null,
  }

  try {
    const wallet = walletClientForKey(input.privateKeyHex)
    if (!wallet) throw new Error('Could not build wallet client')

    const burnHash = await wallet.writeContract({
      address: platformToken as Address,
      abi: BURNABLE_ABI,
      functionName: 'burn',
      args: [boughtRaw],
      account,
      chain: wallet.chain,
    })
    const receipt = await publicClient().waitForTransactionReceipt({ hash: burnHash, timeout: 90_000 })
    if (receipt.status !== 'success') throw new Error('Burn reverted')

    result.burned = true
    result.burnTxHash = burnHash
    result.tokensBurned = Number(formatUnits(boughtRaw, 18))
  } catch (err) {
    // Bought but not burned is a real state, not a rounding error. The tokens
    // sit in the payout wallet and the next cycle does not re-burn them.
    result.error = `Bought but burn failed: ${err instanceof Error ? err.message : String(err)}`
  }

  await recordFlywheelRound({ ...result, tenantSlug: input.tenantSlug, cycle: input.cycle, platformToken })
  return result
}

/** Append-only record backing the public flywheel numbers. */
async function recordFlywheelRound(
  round: FlywheelResult & { tenantSlug: string; cycle: number; platformToken: string }
): Promise<void> {
  try {
    await connectDB()
    const db = mongoose.connection.db
    if (!db) return
    await db.collection(FLYWHEEL_BUYBACKS_COLLECTION).insertOne({
      chainId: getChainId(),
      platformToken: round.platformToken.toLowerCase(),
      tenantSlug: round.tenantSlug,
      cycle: round.cycle,
      spentEth: round.spentEth,
      tokensBurned: round.tokensBurned,
      burned: round.burned,
      buyTxHash: round.buyTxHash,
      burnTxHash: round.burnTxHash,
      error: round.error,
      createdAt: new Date(),
    })
  } catch (err) {
    // Losing the record must not fail the cycle; the chain is the real ledger.
    console.warn('[Flywheel] Could not record round:', err instanceof Error ? err.message : err)
  }
}
