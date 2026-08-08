'use client'

import { useEffect, useRef, useState } from 'react'
import type { PublicTenantSummary } from '@/lib/tenant/types'
import {
  catalogCountdownSubtitle,
  isCatalogPayoutPaused,
} from '@/lib/platform/catalogClient'
import { formatPayoutCountdown } from '@/lib/payout/timerMath'

interface CatalogCountdownProps {
  tenant: PublicTenantSummary
  compact?: boolean
}

export function CatalogCountdown({ tenant, compact = false }: CatalogCountdownProps) {
  const serverSeconds = tenant.payout_seconds_remaining
  const [seconds, setSeconds] = useState<number | null>(serverSeconds ?? null)
  const ref = useRef<number | null>(serverSeconds ?? null)

  useEffect(() => {
    if (tenant.payout_timer_status === 'waiting') {
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
  }, [serverSeconds, tenant.payout_timer_status, tenant.slug])

  useEffect(() => {
    if (tenant.payout_timer_status !== 'active') return
    const tick = setInterval(() => {
      setSeconds(prev => {
        if (prev === null) return null
        const next = Math.max(0, prev - 1)
        ref.current = next
        return next
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [tenant.payout_timer_status, tenant.slug])

  const subtitle = catalogCountdownSubtitle(tenant)
  const paused = isCatalogPayoutPaused(tenant)

  if (paused) {
    return (
      <div className={compact ? 'mt-1' : 'mt-1.5'}>
        <p className={`text-amber-200/80 ${compact ? 'text-xs' : 'text-sm'}`}>
          Launch limbo — waiting for eligible holders
        </p>
        {subtitle ? (
          <p className={`text-gray-500 ${compact ? 'text-[0.65rem]' : 'text-xs'} mt-0.5`}>{subtitle}</p>
        ) : null}
      </div>
    )
  }

  if (tenant.payout_timer_status === 'active' && seconds != null) {
    const due = seconds <= 0
    return (
      <div className={compact ? 'mt-1' : 'mt-1.5'}>
        <p
          className={`font-mono font-semibold tabular-nums ${
            due ? 'text-sol-mint animate-pulse' : 'text-white'
          } ${compact ? 'text-sm' : 'text-base'}`}
        >
          {due ? '00:00 · payout due' : `${formatPayoutCountdown(seconds)} · next payout`}
        </p>
        {tenant.payout_current_cycle != null && tenant.payout_current_cycle > 0 ? (
          <p className={`text-gray-500 ${compact ? 'text-[0.65rem]' : 'text-xs'} mt-0.5`}>
            Cycle {tenant.payout_current_cycle + 1}
            {subtitle ? ` · ${subtitle.toLowerCase()}` : ''}
          </p>
        ) : subtitle ? (
          <p className={`text-gray-500 ${compact ? 'text-[0.65rem]' : 'text-xs'} mt-0.5`}>{subtitle}</p>
        ) : null}
      </div>
    )
  }

  if (tenant.payoutIntervalMinutes) {
    return (
      <p className={`text-gray-400 ${compact ? 'text-xs' : 'text-sm'} mt-1`}>
        Payouts every {tenant.payoutIntervalMinutes} minutes
      </p>
    )
  }

  return null
}
