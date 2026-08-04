/**
 * Payout timer — waiting/active states and eligibility-gated start
 */

import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { TimerState, Holder, CurrentRankings } from '@/lib/db/models'

jest.mock('@/lib/config', () => ({
  config: {
    tokenMint: '0x0000000000000000000000000000000000000001',
    tokenSymbol: 'TEST',
    payoutIntervalMinutes: 120,
    poolPercentage: 0.99,
    minPoolEth: 0.025,
    devFeePct: 0.12,
    payoutSplit: { first: 0.60, second: 0.25, third: 0.15 },
    executePayouts: false,
  },
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
      tokenMint: '0xoldtoken000000000000000000000000000001',
      timerStatus: 'active',
      lastPayoutTime: new Date(),
      currentCycle: 5,
    })
    await Holder.create({
      wallet: '0xholder',
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
})
