'use client'

import { useEffect, useRef, useState } from 'react'
import type { PublicTenantSummary } from '@/lib/tenant/types'
import {
  catalogCountdownSubtitle,
  isCatalogPayoutPaused,
  isCatalogTimerActive,
} from '@/lib/platform/catalogClient'
import { formatPayoutCountdown } from '@/lib/payout/timerMath'

interface CatalogCountdownProps {
  tenant: PublicTenantSummary
  compact?: boolean
}

/** Fixed-height slot so catalog cards/rows stay aligned when limbo vs countdown. */
const COUNTDOWN_SLOT_CLASS = 'min-h-[2.875rem] flex flex-col justify-center'

export function CatalogCountdown({ tenant, compact = false }: CatalogCountdownProps) {
  const serverSeconds = tenant.payout_seconds_remaining
  const [seconds, setSeconds] = useState<number | null>(serverSeconds ?? null)
  const ref = useRef<number | null>(serverSeconds ?? null)
  const timerActive = isCatalogTimerActive(tenant)

  useEffect(() => {
    if (!timerActive) {
      ref.current = null
      setSeconds(null)
      return
    }
    if (serverSeconds == null) {
      ref.current = null
      setSeconds(null)
      return
    }
    if (ref.current === null || Math.abs(serverSeconds - ref.current) > 5) {
      ref.current = serverSeconds
      setSeconds(serverSeconds)
    }
  }, [serverSeconds, timerActive, tenant.slug])

  useEffect(() => {
    if (!timerActive) return
    const tick = setInterval(() => {
      setSeconds(prev => {
        if (prev === null) return null
        const next = Math.max(0, prev - 1)
        ref.current = next
        return next
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [timerActive, tenant.slug])

  const subtitle = catalogCountdownSubtitle(tenant)
  const paused = isCatalogPayoutPaused(tenant)
  const starting = paused && (tenant.payout_eligible_count ?? 0) > 0
  const textSize = compact ? 'text-xs' : 'text-sm'
  const monoSize = compact ? 'text-sm' : 'text-base'

  if (paused && starting) {
    return (
      <div className={`${COUNTDOWN_SLOT_CLASS} ${compact ? 'mt-1' : 'mt-1.5'}`}>
        <p className={`font-medium text-rh-lime/90 ${textSize} leading-snug`}>
          {tenant.payout_eligible_count ?? 0} eligible
        </p>
        <p className={`text-gray-500 ${compact ? 'text-[0.65rem]' : 'text-xs'} mt-0.5 leading-snug truncate`}>
          Payout timer starting
        </p>
      </div>
    )
  }

  if (paused) {
    return (
      <div className={`${COUNTDOWN_SLOT_CLASS} ${compact ? 'mt-1' : 'mt-1.5'}`}>
        <p className={`font-medium text-amber-200/90 ${textSize} leading-snug`}>Listing limbo</p>
        <p className={`text-gray-500 ${compact ? 'text-[0.65rem]' : 'text-xs'} mt-0.5 leading-snug truncate`}>
          Waiting for eligible holders
        </p>
      </div>
    )
  }

  if (timerActive && seconds != null) {
    const due = seconds <= 0
    return (
      <div className={`${COUNTDOWN_SLOT_CLASS} ${compact ? 'mt-1' : 'mt-1.5'}`}>
        <p
          className={`font-mono font-semibold tabular-nums leading-snug ${
            due ? 'text-sol-mint animate-pulse' : 'text-white'
          } ${monoSize}`}
        >
          {due ? '00:00 · due' : `${formatPayoutCountdown(seconds)} · next`}
        </p>
        <p className={`text-gray-500 ${compact ? 'text-[0.65rem]' : 'text-xs'} mt-0.5 leading-snug truncate`}>
          {tenant.payout_current_cycle != null && tenant.payout_current_cycle > 0
            ? `Cycle ${tenant.payout_current_cycle + 1}`
            : 'Next payout'}
        </p>
      </div>
    )
  }

  return (
    <div className={`${COUNTDOWN_SLOT_CLASS} ${compact ? 'mt-1' : 'mt-1.5'}`}>
      <p className={`text-gray-400 ${textSize} leading-snug`}>
        {tenant.payoutIntervalMinutes
          ? `Every ${tenant.payoutIntervalMinutes} min`
          : 'Awaiting start'}
      </p>
      {subtitle ? (
        <p className={`text-gray-500 ${compact ? 'text-[0.65rem]' : 'text-xs'} mt-0.5 leading-snug truncate`}>
          {subtitle}
        </p>
      ) : (
        <p className={`text-gray-600 ${compact ? 'text-[0.65rem]' : 'text-xs'} mt-0.5 invisible`} aria-hidden>
          placeholder
        </p>
      )}
    </div>
  )
}
