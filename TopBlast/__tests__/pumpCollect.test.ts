import {
  minPumpCollectUsd,
  pumpCollectThrottleMs,
  isPumpAutoCollectEnabled,
} from '@/lib/pump/config'
import {
  markPumpCollectAttempt,
  resetPumpCollectThrottle,
  shouldThrottlePumpCollect,
} from '@/lib/pump/collectThrottle'

describe('pump collect config', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
  })

  afterEach(() => {
    process.env = env
  })

  it('defaults minimum collect to $1', () => {
    delete process.env.PUMP_MIN_COLLECT_USD
    expect(minPumpCollectUsd()).toBe(1)
  })

  it('respects PUMP_MIN_COLLECT_USD override', () => {
    process.env.PUMP_MIN_COLLECT_USD = '2.5'
    expect(minPumpCollectUsd()).toBe(2.5)
  })

  it('can disable auto collect', () => {
    process.env.PUMP_AUTO_COLLECT_ENABLED = 'false'
    expect(isPumpAutoCollectEnabled()).toBe(false)
  })
})

describe('pump collect throttle', () => {
  beforeEach(() => {
    resetPumpCollectThrottle()
    process.env.PUMP_COLLECT_MIN_INTERVAL_MS = '60000'
  })

  afterEach(() => {
    resetPumpCollectThrottle()
  })

  it('throttles repeated attempts within interval', () => {
    expect(shouldThrottlePumpCollect('pepe')).toBe(false)
    markPumpCollectAttempt('pepe')
    expect(shouldThrottlePumpCollect('pepe')).toBe(true)
    expect(shouldThrottlePumpCollect('bonk')).toBe(false)
  })

  it('uses pumpCollectThrottleMs from env', () => {
    expect(pumpCollectThrottleMs()).toBe(60_000)
  })
})
