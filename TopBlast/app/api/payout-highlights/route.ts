import { NextResponse } from 'next/server'
import { fetchTokenPayoutHighlights } from '@/lib/payout/payoutHighlights'

export const dynamic = 'force-dynamic'

/** Largest payout and all-time totals for one token, for the leaderboard header. */
export async function GET(request: Request) {
  const mint = new URL(request.url).searchParams.get('mint')?.trim() ?? ''
  if (!/^[A-Za-z0-9]{32,64}$/.test(mint)) {
    return NextResponse.json({ success: false, error: 'mint required' }, { status: 400 })
  }
  try {
    const data = await fetchTokenPayoutHighlights(mint)
    return NextResponse.json(
      { success: true, data },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load payout highlights'
    console.error('[PayoutHighlights]', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
