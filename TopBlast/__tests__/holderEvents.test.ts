/**
 * Holder-event capture (retention analytics instrumentation).
 * The invariants that matter:
 *  - diffing is pure and precise (buys/sells/eligibility flips/exits)
 *  - price-only recomputes never fabricate balance history
 *  - a full board never claims "sold_out" for wallets that may just be cut
 *  - the safe recorder NEVER throws, even with a broken database
 */

import type { MongoMemoryServer } from 'mongodb-memory-server'
import {
  diffRankingsForEvents,
  recordHolderEventsSafe,
  type EventRankingRow,
} from '@/lib/analytics/holderEvents'
import { HolderEvent } from '@/lib/db/analyticsModels'
import {
  clearMemoryCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from './helpers/memoryMongo'

const CTX = {
  tenantSlug: 'pepe',
  tokenPrice: 0.001,
  source: 'chain_refresh' as const,
  persistMax: 50,
}

function row(wallet: string, balance: number, isEligible = false, drawdownPct = -50): EventRankingRow {
  return { wallet, balance, isEligible, drawdownPct }
}

describe('diffRankingsForEvents', () => {
  it('emits first_seen for new wallets on a chain refresh', () => {
    const events = diffRankingsForEvents([], [row('A', 1000, true)], CTX)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'first_seen',
      wallet: 'A',
      balance: 1000,
      prevBalance: null,
      delta: 1000,
      isEligible: true,
      tenantSlug: 'pepe',
    })
  })

  it('emits balance_increase / balance_decrease for meaningful moves', () => {
    const prev = [row('A', 1000), row('B', 1000)]
    const next = [row('A', 1500), row('B', 400)]
    const events = diffRankingsForEvents(prev, next, CTX)
    expect(events.find(e => e.wallet === 'A')).toMatchObject({
      type: 'balance_increase',
      delta: 500,
      prevBalance: 1000,
    })
    expect(events.find(e => e.wallet === 'B')).toMatchObject({
      type: 'balance_decrease',
      delta: -600,
    })
  })

  it('ignores dust jitter below the relative threshold', () => {
    const prev = [row('A', 1_000_000)]
    const next = [row('A', 1_000_500)] // +0.05% — noise
    expect(diffRankingsForEvents(prev, next, CTX)).toHaveLength(0)
  })

  it('records eligibility transitions in both directions', () => {
    const prev = [row('A', 1000, false), row('B', 1000, true)]
    const next = [row('A', 1000, true), row('B', 1000, false)]
    const events = diffRankingsForEvents(prev, next, CTX)
    expect(events.find(e => e.wallet === 'A')?.type).toBe('eligible_enter')
    expect(events.find(e => e.wallet === 'B')?.type).toBe('eligible_exit')
  })

  it('price recomputes record eligibility flips but never balance history', () => {
    const ctx = { ...CTX, source: 'price_recompute' as const }
    const prev = [row('A', 1000, false), row('B', 2000)]
    const next = [row('A', 1000, true), row('B', 9000), row('NEW', 500)]
    const events = diffRankingsForEvents(prev, next, ctx)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ wallet: 'A', type: 'eligible_enter' })
  })

  it('emits sold_out when a wallet vanishes from a board with free space', () => {
    const events = diffRankingsForEvents([row('A', 1000), row('B', 500)], [row('A', 1000)], CTX)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'sold_out',
      wallet: 'B',
      balance: 0,
      prevBalance: 500,
      delta: -500,
    })
  })

  it('emits ambiguous dropped_out instead when the board is full', () => {
    const persistMax = 3
    const prev = [row('A', 900), row('B', 500), row('C', 400)]
    const next = [row('A', 900), row('D', 800), row('E', 700)]
    const events = diffRankingsForEvents(prev, next, { ...CTX, persistMax })
    const gone = events.filter(e => e.type === 'dropped_out').map(e => e.wallet)
    expect(gone.sort()).toEqual(['B', 'C'])
    expect(events.some(e => e.type === 'sold_out')).toBe(false)
  })

  it('caps runaway persists, keeping the highest-signal events', () => {
    const prev: EventRankingRow[] = []
    for (let i = 0; i < 600; i++) prev.push(row(`W${i}`, 1000))
    // everyone vanishes from a spacious board → 600 sold_out candidates
    const events = diffRankingsForEvents(prev, [], { ...CTX, persistMax: 1000 })
    expect(events.length).toBeLessThanOrEqual(400)
    expect(events.every(e => e.type === 'sold_out')).toBe(true)
  })
})

describe('recordHolderEventsSafe', () => {
  let mongo: MongoMemoryServer

  beforeAll(async () => {
    mongo = await startMemoryMongo()
  })

  afterAll(async () => {
    await stopMemoryMongo(mongo)
  })

  beforeEach(async () => {
    await clearMemoryCollections()
  })

  it('persists the diffed events', async () => {
    const count = await recordHolderEventsSafe(
      [row('A', 1000, false)],
      [row('A', 2000, true)],
      CTX
    )
    expect(count).toBe(2) // balance_increase + eligible_enter

    const saved = await HolderEvent.find({ tenantSlug: 'pepe' }).lean()
    expect(saved).toHaveLength(2)
    expect(new Set(saved.map(e => e.type))).toEqual(
      new Set(['balance_increase', 'eligible_enter'])
    )
    expect(saved.every(e => e.wallet === 'A')).toBe(true)
    expect(saved.every(e => e.createdAt instanceof Date)).toBe(true)
  })

  it('is a no-op when nothing changed', async () => {
    const count = await recordHolderEventsSafe([row('A', 1000)], [row('A', 1000)], CTX)
    expect(count).toBe(0)
    expect(await HolderEvent.countDocuments()).toBe(0)
  })

  it('respects the HOLDER_EVENTS_ENABLED kill switch', async () => {
    process.env.HOLDER_EVENTS_ENABLED = 'false'
    try {
      const count = await recordHolderEventsSafe([], [row('A', 1000)], CTX)
      expect(count).toBe(0)
      expect(await HolderEvent.countDocuments()).toBe(0)
    } finally {
      delete process.env.HOLDER_EVENTS_ENABLED
    }
  })

  it('never throws even when the insert fails', async () => {
    const spy = jest
      .spyOn(HolderEvent, 'insertMany')
      .mockRejectedValueOnce(new Error('mongo exploded'))
    try {
      await expect(
        recordHolderEventsSafe([], [row('A', 1000)], CTX)
      ).resolves.toBe(0)
    } finally {
      spy.mockRestore()
    }
  })
})
