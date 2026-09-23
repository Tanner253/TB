'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Seconds remaining, derived from a deadline rather than decremented.
 *
 * The obvious implementation — `setInterval(() => setN(n => n - 1), 1000)` —
 * quietly loses time. Browsers throttle timers in a background tab to roughly
 * one callback a minute, and `setInterval` drifts even in the foreground, so
 * the number freezes and then jumps whenever something resyncs it. Anchoring a
 * deadline once and subtracting from `Date.now()` is immune to all of it: after
 * any amount of throttling, sleep or drift, the next tick shows the truth.
 *
 * Ticks at 250ms so the displayed second flips close to when it really changes
 * instead of up to a second late, and re-reads immediately when the tab becomes
 * visible again. The work per tick is one subtraction, and state only updates
 * when the whole second actually changes, so nothing re-renders needlessly.
 *
 * Pass `null` to stop (and clear) the countdown.
 */
export function useDeadlineCountdown(secondsRemaining: number | null, active = true): number | null {
  const [seconds, setSeconds] = useState<number | null>(
    active && secondsRemaining != null ? secondsRemaining : null
  )
  const deadlineRef = useRef<number | null>(null)

  // Re-anchor only on a real disagreement with the source. Re-anchoring on
  // every render would make the display twitch by a second whenever a poll's
  // latency changed.
  useEffect(() => {
    if (!active || secondsRemaining == null) {
      deadlineRef.current = null
      setSeconds(null)
      return
    }
    const current =
      deadlineRef.current == null
        ? null
        : Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000))
    if (current === null || Math.abs(secondsRemaining - current) > 5) {
      deadlineRef.current = Date.now() + secondsRemaining * 1000
      setSeconds(secondsRemaining)
    }
  }, [secondsRemaining, active])

  useEffect(() => {
    if (!active) return
    const sync = () => {
      const deadline = deadlineRef.current
      if (deadline === null) return
      const next = Math.max(0, Math.round((deadline - Date.now()) / 1000))
      setSeconds(prev => (prev === next ? prev : next))
    }
    sync()
    const timer = setInterval(sync, 250)
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('focus', sync)
    }
  }, [active])

  return seconds
}
