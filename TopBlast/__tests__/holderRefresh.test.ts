import {
  holderRefreshIntervalMs,
  markHolderRefresh,
  resetHolderRefreshThrottle,
  shouldSkipHolderRefresh,
} from '@/lib/platform/holderRefresh'

describe('holderRefresh throttle', () => {
  beforeEach(() => {
    resetHolderRefreshThrottle()
    delete process.env.HOLDER_REFRESH_INTERVAL_MS
  })

  it('defaults to 60s interval', () => {
    expect(holderRefreshIntervalMs()).toBe(60_000)
  })

  it('skips refresh within interval unless forced', () => {
    markHolderRefresh('tenant-a')
    expect(shouldSkipHolderRefresh('tenant-a', false)).toBe(true)
    expect(shouldSkipHolderRefresh('tenant-a', true)).toBe(false)
  })

  it('allows refresh after interval elapses', () => {
    jest.useFakeTimers()
    markHolderRefresh('tenant-a')
    jest.advanceTimersByTime(61_000)
    expect(shouldSkipHolderRefresh('tenant-a', false)).toBe(false)
    jest.useRealTimers()
  })
})
