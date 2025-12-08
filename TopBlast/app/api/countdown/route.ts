import { NextResponse } from 'next/server'
import { getSecondsUntilNextPayout, getCurrentPayoutCycle, ensureTimerStateSync } from '@/lib/payout/executor'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // CRITICAL: Sync timer state from database for cross-instance consistency
    // This ensures all Vercel serverless instances show the same countdown
    await ensureTimerStateSync()
    
    const secondsRemaining = getSecondsUntilNextPayout()
    const currentCycle = getCurrentPayoutCycle()

    return NextResponse.json({
      success: true,
      data: {
        current_cycle: currentCycle + 1, // Next cycle number
        seconds_remaining: secondsRemaining,
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
