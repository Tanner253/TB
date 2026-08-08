import {
  tryInvalidateTokenHoldersCache,
  setCachedTokenHolders,
  getCachedTokenHolders,
  getHolderFetchCooldownRemaining,
  HOLDER_FORCE_REFRESH_COOLDOWN_MS,
  HOLDER_HELIUS_MIN_FETCH_MS,
} from '@/lib/solana/heliusCache'

describe('Helius holder throttle', () => {
  const mint = 'So11111111111111111111111111111111111111112'

  beforeEach(() => {
    global._heliusHolderCache = undefined
    global._heliusHolderStale = undefined
    global._heliusHolderLastFetch = undefined
    global._heliusIndexThrottle = undefined
  })

  it('blocks force refresh within cooldown window', () => {
    const first = tryInvalidateTokenHoldersCache(mint)
    expect(first.allowed).toBe(true)

    const second = tryInvalidateTokenHoldersCache(mint)
    expect(second.allowed).toBe(false)
    expect(second.retryAfterMs).toBeGreaterThan(0)
    expect(second.retryAfterMs).toBeLessThanOrEqual(HOLDER_FORCE_REFRESH_COOLDOWN_MS)
  })

  it('reports fetch cooldown after caching holders', () => {
    setCachedTokenHolders(mint, [{ wallet: 'abc', balance: 1_000_000 }], 60_000)
    expect(getCachedTokenHolders(mint)).toHaveLength(1)
    expect(getHolderFetchCooldownRemaining(mint)).toBeGreaterThan(0)
    expect(getHolderFetchCooldownRemaining(mint)).toBeLessThanOrEqual(
      HOLDER_HELIUS_MIN_FETCH_MS
    )
  })
})
