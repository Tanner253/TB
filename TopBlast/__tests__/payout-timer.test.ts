/**
 * Payout timer — waiting/active states and eligibility-gated start
 */

import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { TimerState, Holder, CurrentRankings } from '@/lib/db/models'

jest.mock('@/lib/config', () => ({
  config: {
    tokenMint: 'So11111111111111111111111111111111111111112',
    tokenSymbol: 'TEST',
    payoutIntervalMinutes: 120,
    poolPercentage: 0.99,
    minPoolSol: 0.025,
    minPoolEth: 0.025,
    minPoolForPayout: 5,
    devFeePct: 0.12,
    payoutSplit: { first: 0.60, second: 0.25, third: 0.15 },
    executePayouts: false,
  },
}))

jest.mock('@/lib/payout/poolBalance', () => ({
  getLivePoolBalance: jest.fn(async () => ({
    payoutWalletAddress: 'Pool1111111111111111111111111111111111',
    walletSol: 1,
    poolSol: 0.99,
    poolUsd: 150,
    solPrice: 150,
    poolUsdFormatted: '$150.00',
    poolSolFormatted: '0.9900',
    walletEth: 1,
    poolEth: 0.99,
    ethPrice: 150,
    poolEthFormatted: '0.9900',
    minLossUsd: 15,
    minLossUsdFormatted: '$15.00',
    available: true,
  })),
  invalidateLivePoolBalanceCache: jest.fn(),
}))

describe('Payout timer', () => {
  let mongoServer: MongoMemoryServer

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create()
    process.env.MONGODB_URI = mongoServer.getUri()
    await mongoose.connect(process.env.MONGODB_URI)
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
  })

  beforeEach(async () => {
    ;(global as any).mongoose = { conn: null, promise: null }
    global._payoutTimerCaches = undefined
    await TimerState.deleteMany({})
    await Holder.deleteMany({})
    await CurrentRankings.deleteMany({})
    jest.resetModules()
  })

  it('starts in waiting state with no countdown', async () => {
    const { ensureTimerStateSync, getPayoutTimerInfo } = await import('@/lib/payout/executor')

    await ensureTimerStateSync()
    const timer = getPayoutTimerInfo()

    expect(timer.timer_status).toBe('waiting')
    expect(timer.seconds_remaining).toBeNull()
    expect(timer.current_cycle).toBe(0)
  })

  it('starts countdown when first eligible holder appears', async () => {
    const { ensureTimerStateSync, maybeStartPayoutTimer, getPayoutTimerInfo } = await import('@/lib/payout/executor')

    await ensureTimerStateSync()
    expect((await maybeStartPayoutTimer(0))).toBe(false)

    const started = await maybeStartPayoutTimer(1)
    expect(started).toBe(true)

    const timer = getPayoutTimerInfo()
    expect(timer.timer_status).toBe('active')
    expect(timer.seconds_remaining).toBeGreaterThan(0)
    expect(timer.seconds_remaining).toBeLessThanOrEqual(120 * 60)
  })

  it('resets holder state when token mint changes', async () => {
    await TimerState.create({
      key: 'payout_timer',
      tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      timerStatus: 'active',
      lastPayoutTime: new Date(),
      currentCycle: 5,
    })
    await Holder.create({
      wallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuQosgAsU',
      balance: 1000000,
      vwap: 0.001,
      isEligible: true,
    })

    const { ensureTimerStateSync, getPayoutTimerInfo } = await import('@/lib/payout/executor')
    await ensureTimerStateSync()

    const holdersLeft = await Holder.countDocuments()
    expect(holdersLeft).toBe(0)

    const timer = getPayoutTimerInfo()
    expect(timer.timer_status).toBe('waiting')
    expect(timer.current_cycle).toBe(0)
  })

  it('does not mark payout due while waiting', async () => {
    const { ensureTimerStateSync, isPayoutDue } = await import('@/lib/payout/executor')

    await ensureTimerStateSync()
    expect(isPayoutDue()).toBe(false)
  })

  it('maybeExecuteDuePayout pauses when due with zero eligible holders', async () => {
    await TimerState.findOneAndUpdate(
      { key: 'payout_timer' },
      {
        tokenMint: 'So11111111111111111111111111111111111111112',
        timerStatus: 'active',
        lastPayoutTime: new Date(Date.now() - 121 * 60 * 1000),
        currentCycle: 2,
        isPayoutInProgress: false,
      },
      { upsert: true }
    )
    jest.resetModules()
    const mod = await import('@/lib/payout/executor')
    await mod.ensureTimerStateSync()

    const result = await mod.maybeExecuteDuePayout(0)
    expect(result?.data?.skipped).toBe(true)
    expect(mod.getPayoutTimerInfo().timer_status).toBe('waiting')
  })

  it('does not start countdown when pool is below USD minimum', async () => {
    const { getLivePoolBalance } = await import('@/lib/payout/poolBalance')
    ;(getLivePoolBalance as jest.Mock).mockResolvedValueOnce({
      payoutWalletAddress: 'Pool1111111111111111111111111111111111',
      walletSol: 0.01,
      poolSol: 0.009,
      poolUsd: 0.67,
      solPrice: 75,
      poolUsdFormatted: '$0.67',
      poolSolFormatted: '0.0090',
      walletEth: 0.01,
      poolEth: 0.009,
      ethPrice: 75,
      poolEthFormatted: '0.0090',
      minLossUsd: 0.06,
      minLossUsdFormatted: '$0.06',
      available: true,
    })

    const { ensureTimerStateSync, maybeStartPayoutTimer, getPayoutTimerInfo } = await import('@/lib/payout/executor')
    await ensureTimerStateSync()
    expect(await maybeStartPayoutTimer(1)).toBe(false)
    expect(getPayoutTimerInfo().timer_status).toBe('waiting')
  })

  it('pauses due timer when pool drops below USD minimum', async () => {
    await TimerState.findOneAndUpdate(
      { key: 'payout_timer' },
      {
        tokenMint: 'So11111111111111111111111111111111111111112',
        timerStatus: 'active',
        lastPayoutTime: new Date(Date.now() - 121 * 60 * 1000),
        currentCycle: 2,
        isPayoutInProgress: false,
      },
      { upsert: true }
    )

    const { getLivePoolBalance } = await import('@/lib/payout/poolBalance')
    ;(getLivePoolBalance as jest.Mock).mockResolvedValue({
      payoutWalletAddress: 'Pool1111111111111111111111111111111111',
      walletSol: 0.01,
      poolSol: 0.009,
      poolUsd: 0.67,
      solPrice: 75,
      poolUsdFormatted: '$0.67',
      poolSolFormatted: '0.0090',
      walletEth: 0.01,
      poolEth: 0.009,
      ethPrice: 75,
      poolEthFormatted: '0.0090',
      minLossUsd: 0.06,
      minLossUsdFormatted: '$0.06',
      available: true,
    })

    jest.resetModules()
    const mod = await import('@/lib/payout/executor')
    await mod.ensureTimerStateSync()
    expect(mod.isPayoutDue()).toBe(true)

    const result = await mod.maybeExecuteDuePayout(1)
    expect(result?.success).toBe(false)
    expect(mod.getPayoutTimerInfo().timer_status).toBe('waiting')
  })

  it('syncPayoutTimerWithEligibility pauses active timer when eligible drops to zero before due', async () => {
    await TimerState.findOneAndUpdate(
      { key: 'payout_timer' },
      {
        tokenMint: 'So11111111111111111111111111111111111111112',
        timerStatus: 'active',
        lastPayoutTime: new Date(),
        currentCycle: 3,
        isPayoutInProgress: false,
      },
      { upsert: true }
    )
    jest.resetModules()
    const mod = await import('@/lib/payout/executor')
    await mod.ensureTimerStateSync()

    expect(mod.getPayoutTimerInfo().timer_status).toBe('active')
    expect(mod.getPayoutTimerInfo().seconds_remaining).toBeGreaterThan(0)

    await mod.syncPayoutTimerWithEligibility(0)

    expect(mod.getPayoutTimerInfo().timer_status).toBe('waiting')
    expect(mod.getPayoutTimerInfo().seconds_remaining).toBeNull()
    expect(mod.getPayoutTimerInfo().current_cycle).toBe(3)
  })

  it('syncPayoutTimerWithPayableWinners starts timer from known eligible count', async () => {
    const mod = await import('@/lib/payout/executor')
    await mod.ensureTimerStateSync()
    expect(mod.getPayoutTimerInfo().timer_status).toBe('waiting')

    const result = await mod.syncPayoutTimerWithPayableWinners(3)
    expect(result.timerEligibleCount).toBe(3)

    const timer = mod.getPayoutTimerInfo()
    expect(timer.timer_status).toBe('active')
    expect(timer.seconds_remaining).toBeGreaterThan(0)
  })
})
