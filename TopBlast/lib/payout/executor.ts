/**
 * Payout Executor - timer, deployment reset, and payout execution.
 * Timer stays in "waiting" until the first eligible holder exists, then counts down uniformly via MongoDB.
 */

import connectDB from '@/lib/db'
import { Payout, Holder, Disqualification, TimerState, CurrentRankings } from '@/lib/db/models'
import { transferEth, getPayoutWalletBalance } from '@/lib/evm/transfer'
import { getEthPrice } from '@/lib/evm/price'
import { getTxExplorerUrl } from '@/lib/evm/explorer'
import { config } from '@/lib/config'
import { saveRankingsToDb, loadRankingsFromDb, getRankedLosers, markWinnersCooldown } from '@/lib/tracker/holderService'

const MIN_TRANSFER_ETH = 0.001
const TIMER_KEY = 'payout_timer'

export type PayoutTimerStatus = 'waiting' | 'active'

export interface PayoutTimerInfo {
  timer_status: PayoutTimerStatus
  seconds_remaining: number | null
  current_cycle: number
  next_cycle: number
}

let timerCache: {
  lastPayoutTime: number | null
  currentCycle: number
  timerStatus: PayoutTimerStatus
  tokenMint: string
  lastSync: number
} = {
  lastPayoutTime: null,
  currentCycle: 0,
  timerStatus: 'waiting',
  tokenMint: '',
  lastSync: 0,
}

function getIntervalSeconds(): number {
  return config.payoutIntervalMinutes * 60
}

function normalizeMint(mint: string): string {
  return mint.toLowerCase()
}

function getExplorerLink(txHash: string | null): string | null {
  return getTxExplorerUrl(txHash)
}

async function resetForNewToken(tokenMint: string): Promise<void> {
  console.log(`[Payout] New token detected (${tokenMint.slice(0, 10)}...) — resetting holder/timer state`)

  await Holder.deleteMany({})
  await CurrentRankings.deleteMany({})
  await Disqualification.deleteMany({})

  const now = new Date()
  await TimerState.findOneAndUpdate(
    { key: TIMER_KEY },
    {
      $set: {
        tokenMint,
        timerStatus: 'waiting',
        lastPayoutTime: null,
        currentCycle: 0,
        failedAttempts: 0,
        isPayoutInProgress: false,
        lockAcquiredAt: null,
        lockCycle: null,
        updatedAt: now,
      },
    },
    { upsert: true }
  )

  timerCache = {
    lastPayoutTime: null,
    currentCycle: 0,
    timerStatus: 'waiting',
    tokenMint,
    lastSync: Date.now(),
  }
}

function applyTimerDoc(state: {
  tokenMint?: string
  timerStatus?: PayoutTimerStatus
  lastPayoutTime?: Date | null
  currentCycle?: number
}): void {
  const tokenMint = state.tokenMint || config.tokenMint
  const timerStatus: PayoutTimerStatus =
    state.timerStatus ||
    ((state.currentCycle || 0) > 0 ? 'active' : 'waiting')

  timerCache = {
    lastPayoutTime: state.lastPayoutTime ? new Date(state.lastPayoutTime).getTime() : null,
    currentCycle: state.currentCycle || 0,
    timerStatus,
    tokenMint,
    lastSync: Date.now(),
  }
}

async function loadTimerState(): Promise<void> {
  try {
    await connectDB()

    if (!config.tokenMint) {
      return
    }

    const expectedMint = normalizeMint(config.tokenMint)
    let state = await TimerState.findOne({ key: TIMER_KEY }).lean()

    if (state && state.tokenMint && normalizeMint(state.tokenMint) !== expectedMint) {
      await resetForNewToken(config.tokenMint)
      return
    }

    if (!state) {
      await TimerState.create({
        key: TIMER_KEY,
        tokenMint: config.tokenMint,
        timerStatus: 'waiting',
        lastPayoutTime: null,
        currentCycle: 0,
        failedAttempts: 0,
        isPayoutInProgress: false,
      })
      timerCache = {
        lastPayoutTime: null,
        currentCycle: 0,
        timerStatus: 'waiting',
        tokenMint: config.tokenMint,
        lastSync: Date.now(),
      }
      console.log('[Payout] Timer initialized in waiting state (starts when first holder is eligible)')
      return
    }

    if (!state.tokenMint) {
      await TimerState.updateOne(
        { key: TIMER_KEY },
        { $set: { tokenMint: config.tokenMint } }
      )
      state = { ...state, tokenMint: config.tokenMint }
    }

    applyTimerDoc(state)
  } catch (error) {
    console.error('[Payout] Failed to load timer state:', error)
  }
}

async function saveTimerState(
  lastPayoutTime: number | null,
  currentCycle: number,
  timerStatus: PayoutTimerStatus = timerCache.timerStatus
): Promise<void> {
  try {
    await TimerState.findOneAndUpdate(
      { key: TIMER_KEY },
      {
        $set: {
          tokenMint: config.tokenMint,
          timerStatus,
          lastPayoutTime: lastPayoutTime ? new Date(lastPayoutTime) : null,
          currentCycle,
          failedAttempts: 0,
          isPayoutInProgress: false,
        },
      },
      { upsert: true }
    )
    timerCache = {
      ...timerCache,
      lastPayoutTime,
      currentCycle,
      timerStatus,
      tokenMint: config.tokenMint,
      lastSync: Date.now(),
    }
  } catch (error) {
    console.error('[Payout] Failed to save timer state:', error)
  }
}

export function getSecondsUntilNextPayout(): number | null {
  if (timerCache.timerStatus !== 'active') {
    return null
  }
  if (!timerCache.lastPayoutTime) {
    return getIntervalSeconds()
  }
  const intervalMs = config.payoutIntervalMinutes * 60 * 1000
  const elapsed = Date.now() - timerCache.lastPayoutTime
  return Math.max(0, Math.floor((intervalMs - elapsed) / 1000))
}

export function getCurrentPayoutCycle(): number {
  return timerCache.currentCycle
}

export function getPayoutTimerStatus(): PayoutTimerStatus {
  return timerCache.timerStatus
}

export function getPayoutTimerInfo(): PayoutTimerInfo {
  return {
    timer_status: timerCache.timerStatus,
    seconds_remaining: getSecondsUntilNextPayout(),
    current_cycle: timerCache.currentCycle,
    next_cycle: timerCache.currentCycle + 1,
  }
}

export async function ensureTimerStateSync(): Promise<void> {
  if (Date.now() - timerCache.lastSync < 5000 && timerCache.lastSync > 0) {
    return
  }
  await loadTimerState()
}

/** Start the payout countdown once at least one holder is eligible. */
export async function maybeStartPayoutTimer(eligibleCount: number): Promise<boolean> {
  await ensureTimerStateSync()

  if (timerCache.timerStatus === 'active') {
    return false
  }
  if (eligibleCount <= 0) {
    return false
  }

  const now = Date.now()
  await saveTimerState(now, timerCache.currentCycle, 'active')
  console.log(`[Payout] Timer started — ${eligibleCount} eligible holder(s)`)
  return true
}

export async function resetTimerForNextInterval(): Promise<void> {
  const now = Date.now()
  await saveTimerState(now, timerCache.currentCycle, 'active')
  console.log(`[Payout] Timer reset for next interval (${config.payoutIntervalMinutes} min)`)
}

export function isPayoutDue(): boolean {
  if (timerCache.timerStatus !== 'active') {
    return false
  }
  const secondsUntil = getSecondsUntilNextPayout()
  return secondsUntil !== null && secondsUntil <= 0
}

async function acquirePayoutLock(cycle: number): Promise<boolean> {
  try {
    const result = await TimerState.findOneAndUpdate(
      {
        key: TIMER_KEY,
        $or: [
          { isPayoutInProgress: false },
          { isPayoutInProgress: { $exists: false } },
          { lockAcquiredAt: { $lt: new Date(Date.now() - 2 * 60 * 1000) } },
        ],
      },
      {
        $set: {
          isPayoutInProgress: true,
          lockAcquiredAt: new Date(),
          lockCycle: cycle,
        },
      },
      { new: true }
    )

    return result !== null
  } catch (error) {
    console.error('[Payout] Failed to acquire lock:', error)
    return false
  }
}

async function releasePayoutLock(): Promise<void> {
  try {
    await TimerState.findOneAndUpdate(
      { key: TIMER_KEY },
      { $set: { isPayoutInProgress: false, lockAcquiredAt: null } }
    )
  } catch (error) {
    console.error('[Payout] Failed to release lock:', error)
  }
}

export interface PayoutResult {
  success: boolean
  cycle?: number
  error?: string
  data?: any
}

export async function executePayout(): Promise<PayoutResult> {
  await ensureTimerStateSync()

  if (timerCache.timerStatus !== 'active') {
    return { success: false, error: 'Payout timer not started' }
  }

  const now = Date.now()
  const nextCycle = timerCache.currentCycle + 1

  try {
    await connectDB()

    const lockAcquired = await acquirePayoutLock(nextCycle)
    if (!lockAcquired) {
      console.log('[Payout] Payout already in progress — skipping duplicate request')
      return { success: false, error: 'Payout already in progress' }
    }

    console.log('')
    console.log('[Payout] ╔════════════════════════════════════════════════════════╗')
    console.log(`[Payout] ║           STARTING PAYOUT CYCLE ${nextCycle}                      ║`)
    console.log('[Payout] ╚════════════════════════════════════════════════════════╝')

    const ethPrice = await getEthPrice() || 3500
    console.log(`[Payout] ETH price: $${ethPrice}`)

    const walletBalance = await getPayoutWalletBalance()
    const walletEth = walletBalance?.eth || walletBalance?.sol || 0
    console.log(`[Payout] Wallet balance: ${walletEth.toFixed(6)} ETH`)

    if (walletEth <= 0) {
      console.log('[Payout] No balance — skipping without advancing cycle')
      await releasePayoutLock()
      return { success: false, error: 'No wallet balance' }
    }

    const poolEth = walletEth * config.poolPercentage
    const poolUsd = poolEth * ethPrice
    console.log(`[Payout] Pool: ${poolEth.toFixed(6)} ETH ($${poolUsd.toFixed(2)})`)

    if (poolEth < config.minPoolEth) {
      console.log(`[Payout] Pool below minimum ${config.minPoolEth} ETH — skipping without advancing cycle`)
      await releasePayoutLock()
      return { success: false, error: 'Pool below minimum' }
    }

    console.log('[Payout] Saving rankings to database...')
    await saveRankingsToDb()

    let eligibleWinners: any[] = []

    const inMemoryRankings = getRankedLosers()
    if (inMemoryRankings.length > 0) {
      eligibleWinners = inMemoryRankings.filter(h => h.isEligible).slice(0, 3)
      console.log(`[Payout] Using in-memory: ${inMemoryRankings.length} total, ${eligibleWinners.length} eligible`)
    } else {
      const dbRankings = await loadRankingsFromDb()
      if (dbRankings && dbRankings.rankings.length > 0) {
        eligibleWinners = dbRankings.rankings.filter((h: any) => h.isEligible).slice(0, 3)
        console.log(`[Payout] Using database: ${dbRankings.rankings.length} total, ${eligibleWinners.length} eligible`)
      }
    }

    if (eligibleWinners.length === 0) {
      console.log('[Payout] No eligible winners — timer stays at zero until someone qualifies')
      await releasePayoutLock()
      return { success: true, data: { skipped: true, reason: 'No eligible winners' } }
    }

    console.log('[Payout] Winners to pay:')
    eligibleWinners.forEach((w: any, i: number) => {
      console.log(`[Payout]   #${i + 1}: ${w.wallet.slice(0, 8)}... (${w.drawdownPct.toFixed(1)}% loss, $${w.lossUsd.toFixed(2)})`)
    })

    const devFeeEth = poolEth * config.devFeePct
    const winnersPoolEth = poolEth - devFeeEth
    const payoutAmounts = [
      winnersPoolEth * config.payoutSplit.first,
      winnersPoolEth * config.payoutSplit.second,
      winnersPoolEth * config.payoutSplit.third,
    ]

    const results: any[] = []
    let totalPaidEth = 0

    console.log('[Payout] Creating pending payout records in database...')

    const pendingPayouts: { id: any; rank: number; wallet: string; amountEth: number }[] = []

    if (config.devWalletAddress && config.executePayouts && devFeeEth >= MIN_TRANSFER_ETH) {
      const devPayout = await Payout.create({
        cycle: nextCycle,
        rank: 0,
        wallet: config.devWalletAddress,
        amount: devFeeEth * ethPrice,
        amountTokens: devFeeEth,
        drawdownPct: 0,
        lossUsd: 0,
        txHash: null,
        status: 'pending',
        errorMessage: null,
      })
      pendingPayouts.push({ id: devPayout._id, rank: 0, wallet: config.devWalletAddress, amountEth: devFeeEth })
    }

    for (let i = 0; i < eligibleWinners.length; i++) {
      const winner = eligibleWinners[i]
      const amountEth = payoutAmounts[i]

      if (amountEth < MIN_TRANSFER_ETH) continue

      const winnerPayout = await Payout.create({
        cycle: nextCycle,
        rank: i + 1,
        wallet: winner.wallet,
        amount: amountEth * ethPrice,
        amountTokens: amountEth,
        drawdownPct: winner.drawdownPct,
        lossUsd: winner.lossUsd,
        txHash: null,
        status: 'pending',
        errorMessage: null,
      })
      pendingPayouts.push({ id: winnerPayout._id, rank: i + 1, wallet: winner.wallet, amountEth })
    }

    console.log(`[Payout] Created ${pendingPayouts.length} pending payout records`)

    for (const pending of pendingPayouts) {
      const isDevFee = pending.rank === 0
      const label = isDevFee ? 'Dev fee' : `#${pending.rank}`

      const currentBalance = await getPayoutWalletBalance()
      const availableEth = currentBalance?.eth || currentBalance?.sol || 0
      const requiredEth = pending.amountEth + 0.001

      if (availableEth < requiredEth) {
        console.log(`[Payout] ${label}: Insufficient balance — skipping`)
        await Payout.findByIdAndUpdate(pending.id, {
          status: 'skipped',
          errorMessage: `Insufficient balance: ${availableEth.toFixed(6)} ETH < ${requiredEth.toFixed(6)} ETH needed`,
        })
        continue
      }

      console.log(`[Payout] ${label}: Sending ${pending.amountEth.toFixed(6)} ETH to ${pending.wallet.slice(0, 10)}...`)

      const txResult = config.executePayouts
        ? await transferEth(pending.wallet, pending.amountEth)
        : { success: false, txHash: null, error: 'EXECUTE_PAYOUTS disabled' }

      console.log(`[Payout] ${label} result: ${txResult.success ? '✅' : '❌'} ${txResult.txHash || txResult.error}`)

      await Payout.findByIdAndUpdate(pending.id, {
        txHash: txResult.txHash,
        status: txResult.success ? 'success' : 'failed',
        errorMessage: txResult.error,
      })

      if (txResult.success) {
        totalPaidEth += pending.amountEth

        if (!isDevFee) {
          await Disqualification.create({
            wallet: pending.wallet,
            reason: 'winner_cooldown',
            expiresAt: new Date(Date.now() + config.payoutIntervalMinutes * 60 * 1000 * 2),
          }).catch(() => {})

          await Holder.findOneAndUpdate(
            { wallet: pending.wallet },
            { lastWinCycle: nextCycle, updatedAt: new Date() },
            { upsert: true }
          ).catch(() => {})
        }
      }

      results.push({
        rank: pending.rank,
        type: isDevFee ? 'dev_fee' : 'winner',
        wallet: pending.wallet,
        amount_eth: pending.amountEth.toFixed(6),
        status: txResult.success ? 'success' : 'failed',
        tx_hash: txResult.txHash,
        error: txResult.error,
      })
    }

    await saveTimerState(now, nextCycle, 'active')

    const successfulWinnerWallets = results
      .filter(r => r.type === 'winner' && r.status === 'success')
      .map(r => r.wallet)

    if (successfulWinnerWallets.length > 0) {
      markWinnersCooldown(successfulWinnerWallets, nextCycle)
      console.log(`[Payout] Updated ${successfulWinnerWallets.length} winners with cooldown in memory`)
    }

    await saveRankingsToDb()

    console.log('')
    console.log('[Payout] ╔════════════════════════════════════════════════════════╗')
    console.log(`[Payout] ║  ✅ CYCLE ${nextCycle} COMPLETE - ${totalPaidEth.toFixed(6)} ETH PAID              ║`)
    console.log('[Payout] ╚════════════════════════════════════════════════════════╝')

    await releasePayoutLock()

    return {
      success: true,
      cycle: nextCycle,
      data: {
        cycle: nextCycle,
        total_paid_eth: totalPaidEth.toFixed(6),
        total_paid_usd: (totalPaidEth * ethPrice).toFixed(2),
        payouts: results,
      },
    }
  } catch (error: any) {
    console.error('[Payout] ERROR:', error)
    await releasePayoutLock()
    return { success: false, error: error.message }
  }
}

export function canExecutePayout(): boolean {
  return isPayoutDue()
}
