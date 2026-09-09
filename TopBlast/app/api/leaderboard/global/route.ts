import { NextRequest, NextResponse } from 'next/server'
import { fetchGlobalLeaderboard } from '@/lib/payout/globalLeaderboard'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Public Hall of Fame — all-time winners across every session. */
export async function GET(request: NextRequest) {
  try {
    const raw = parseInt(request.nextUrl.searchParams.get('limit') ?? '', 10)
    const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 100) : 25

    const data = await fetchGlobalLeaderboard(limit)
    return NextResponse.json(
      { success: true, data },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load global leaderboard'
    console.error('[GlobalLeaderboard]', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
