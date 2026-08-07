import { NextResponse } from 'next/server'
import { fetchAppPayoutHistory } from '@/lib/payout/historyService'

export const dynamic = 'force-dynamic'

/** App-wide payout history across every session / tenant. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const data = await fetchAppPayoutHistory(limit)

    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch history'
    console.error('[History] App history error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
