import {
  birdeyeHolderFetchMax,
  leaderboardPersistMax,
} from '@/lib/platform/holderLimits'

describe('holderLimits', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    delete process.env.BIRDEYE_HOLDER_FETCH_MAX
    delete process.env.LEADERBOARD_PERSIST_MAX
  })

  afterAll(() => {
    process.env = env
  })

  it('defaults Birdeye fetch to 150 wallets', () => {
    expect(birdeyeHolderFetchMax()).toBe(150)
  })

  it('defaults leaderboard persist to 50 rows', () => {
    expect(leaderboardPersistMax()).toBe(50)
  })

  it('respects env overrides', () => {
    process.env.BIRDEYE_HOLDER_FETCH_MAX = '200'
    process.env.LEADERBOARD_PERSIST_MAX = '75'
    expect(birdeyeHolderFetchMax()).toBe(200)
    expect(leaderboardPersistMax()).toBe(75)
  })
})
