import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import { Snapshot } from '@/lib/db/models'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await connectDB()

    // Get latest snapshot for current cycle
    const latestSnapshot = await Snapshot.findOne().sort({ cycle: -1 })

    const currentCycle = latestSnapshot?.cycle || 0

    // Calculate next payout time (top of next hour)
    const now = new Date()
    const nextPayout = new Date(now)
    nextPayout.setHours(nextPayout.getHours() + 1, 0, 0, 0)
    const secondsRemaining = Math.floor((nextPayout.getTime() - now.getTime()) / 1000)

    return NextResponse.json({
      success: true,
      data: {
        current_cycle: currentCycle,
        next_payout_at: nextPayout.toISOString(),
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
