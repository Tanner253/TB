import { NextResponse } from 'next/server'
import { getPayoutTimerInfo, ensureTimerStateSync } from '@/lib/payout/executor'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await ensureTimerStateSync()

    const timer = getPayoutTimerInfo()

    return NextResponse.json({
      success: true,
      data: {
        timer_status: timer.timer_status,
        current_cycle: timer.current_cycle,
        next_cycle: timer.next_cycle,
        seconds_remaining: timer.seconds_remaining,
        last_payout_error: timer.last_payout_error,
        payout_retry_mode: timer.payout_retry_mode,
      },
    })
  } catch (error) {
    console.error('Error fetching countdown:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch countdown' },
      { status: 500 }
    )
  }
}
