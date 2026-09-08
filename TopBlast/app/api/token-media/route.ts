import { NextRequest, NextResponse } from 'next/server'
import {
  emptyDexScreenerTokenMedia,
  fetchDexScreenerTokenMedia,
} from '@/lib/solana/dexscreenerMedia'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const mint = request.nextUrl.searchParams.get('mint')?.trim()
  if (!mint) {
    return NextResponse.json({ success: false, error: 'mint query param required' }, { status: 400 })
  }

  try {
    const media = (await fetchDexScreenerTokenMedia(mint)) ?? emptyDexScreenerTokenMedia()
    return NextResponse.json(
      { success: true, data: media },
      { headers: { 'Cache-Control': 'public, max-age=300' } }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch token media'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
