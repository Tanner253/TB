import {
  workerOwnsIndexing,
  apiPollsAreReadOnly,
  allowManualHeliusRefreshOnPoll,
  shouldRunHeliusOnLeaderboardPoll,
} from '@/lib/platform/workerMode'
import {
  heliusWalletTxMaxPages,
  leaderboardVwapHydrateMaxPerRequest,
} from '@/lib/platform/heliusLimits'
import {
  DEFAULT_CATALOG_POLL_MS,
  DEFAULT_HISTORY_POLL_MS,
  DEFAULT_LEADERBOARD_POLL_MS,
  DEFAULT_STATS_POLL_MS,
} from '@/lib/platform/clientPollIntervals'

describe('workerMode', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    delete process.env.WORKER_OWNS_INDEXING
    delete process.env.ALLOW_MANUAL_HELIUS_REFRESH
  })

  afterAll(() => {
    process.env = env
  })

  it('defaults to API polls owning indexing', () => {
    expect(workerOwnsIndexing()).toBe(false)
    expect(apiPollsAreReadOnly()).toBe(false)
    expect(shouldRunHeliusOnLeaderboardPoll(false)).toBe(true)
    expect(shouldRunHeliusOnLeaderboardPoll(true)).toBe(true)
  })

  it('read-only polls when WORKER_OWNS_INDEXING=true', () => {
    process.env.WORKER_OWNS_INDEXING = 'true'
    expect(workerOwnsIndexing()).toBe(true)
    expect(apiPollsAreReadOnly()).toBe(true)
    expect(shouldRunHeliusOnLeaderboardPoll(false)).toBe(false)
    expect(shouldRunHeliusOnLeaderboardPoll(true)).toBe(false)
  })

  it('allows manual refresh override when configured', () => {
    process.env.WORKER_OWNS_INDEXING = 'true'
    process.env.ALLOW_MANUAL_HELIUS_REFRESH = 'true'
    expect(shouldRunHeliusOnLeaderboardPoll(false)).toBe(false)
    expect(shouldRunHeliusOnLeaderboardPoll(true)).toBe(true)
  })
})

describe('heliusLimits', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    delete process.env.HELIUS_WALLET_TX_MAX_PAGES
    delete process.env.LEADERBOARD_VWAP_HYDRATE_MAX
  })

  afterAll(() => {
    process.env = env
  })

  it('defaults wallet tx pages to 4 and hydrate cap to 3', () => {
    expect(heliusWalletTxMaxPages()).toBe(4)
    expect(leaderboardVwapHydrateMaxPerRequest()).toBe(3)
  })

  it('respects env overrides within caps', () => {
    process.env.HELIUS_WALLET_TX_MAX_PAGES = '8'
    process.env.LEADERBOARD_VWAP_HYDRATE_MAX = '8'
    expect(heliusWalletTxMaxPages()).toBe(8)
    expect(leaderboardVwapHydrateMaxPerRequest()).toBe(8)
  })
})

describe('clientPollIntervals', () => {
  it('defaults to 60s polls', () => {
    expect(DEFAULT_LEADERBOARD_POLL_MS).toBeGreaterThanOrEqual(60_000)
    expect(DEFAULT_CATALOG_POLL_MS).toBeGreaterThanOrEqual(60_000)
    expect(DEFAULT_STATS_POLL_MS).toBeGreaterThanOrEqual(60_000)
    expect(DEFAULT_HISTORY_POLL_MS).toBeGreaterThanOrEqual(60_000)
  })
})
