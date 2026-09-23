/**
 * The countdown must be derived from a deadline, never decremented.
 *
 * Browsers throttle timers in a background tab to roughly one callback a
 * minute, so a decrementing counter loses a second per missed tick and the
 * display freezes, then jumps when something resyncs it. These compare the two
 * approaches over a simulated freeze; the deadline one is the contract.
 */

/** What the old code did: one tick, one second, regardless of elapsed time. */
function decrementing(start: number, ticksDelivered: number): number {
  return Math.max(0, start - ticksDelivered)
}

/** What useDeadlineCountdown does: subtract from a fixed deadline. */
function fromDeadline(deadlineMs: number, nowMs: number): number {
  return Math.max(0, Math.round((deadlineMs - nowMs) / 1000))
}

describe('countdown survives a throttled tab', () => {
  const START = 900 // a 15-minute cycle
  const t0 = 1_700_000_000_000
  const deadline = t0 + START * 1000

  it('agrees with the old approach while every tick is delivered', () => {
    const elapsed = 10
    expect(fromDeadline(deadline, t0 + elapsed * 1000)).toBe(decrementing(START, elapsed))
  })

  it('stays correct when the tab is backgrounded for two minutes', () => {
    // 120s pass; a throttled tab gets ~2 callbacks instead of 120.
    const now = t0 + 120_000
    expect(fromDeadline(deadline, now)).toBe(780)
    expect(decrementing(START, 2)).toBe(898) // drifted 118 seconds
    expect(fromDeadline(deadline, now)).not.toBe(decrementing(START, 2))
  })

  it('is exact after the tab sleeps past the deadline', () => {
    expect(fromDeadline(deadline, t0 + 1_000_000)).toBe(0)
  })

  it('never goes negative', () => {
    for (const over of [1, 60_000, 86_400_000]) {
      expect(fromDeadline(deadline, deadline + over)).toBe(0)
    }
  })

  it('reaches zero exactly at the deadline', () => {
    expect(fromDeadline(deadline, deadline)).toBe(0)
    expect(fromDeadline(deadline, deadline - 1000)).toBe(1)
  })

  it('is monotonic as real time advances', () => {
    let last = Infinity
    for (let s = 0; s <= START; s += 7) {
      const v = fromDeadline(deadline, t0 + s * 1000)
      expect(v).toBeLessThanOrEqual(last)
      last = v
    }
  })

  it('does not drift over a full cycle, whatever the tick cadence', () => {
    // 250ms ticks: 3600 of them across 900s, all landing on the right second.
    for (const ms of [250, 1000, 5000]) {
      const at = t0 + 899_000
      expect(fromDeadline(deadline, at)).toBe(1)
      expect(fromDeadline(deadline, at - ms)).toBeGreaterThanOrEqual(1)
    }
  })
})
