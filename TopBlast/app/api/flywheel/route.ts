import { NextResponse } from 'next/server'
import { getFlywheelStats } from '@/lib/platform/flywheelStats'
import {
  COMMUNITY_PCT,
  DEV_FEE_PCT,
  PLATFORM_BUYBACK_PCT_OF_POOL,
  PLATFORM_OPS_PCT_OF_POOL,
  PROTOCOL_FEE_PCT,
} from '@/lib/platform/flywheel'
import { autoBuybackEnabled } from '@/lib/platform/platformBuyback'
import { getPlatformTokenMint, getPlatformTokenSymbol } from '@/lib/platform/config'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** Public flywheel numbers for the homepage panel. */
export async function GET() {
  const stats = await getFlywheelStats()

  return NextResponse.json(
    {
      success: true,
      data: {
        ...stats,
        token: {
          symbol: getPlatformTokenSymbol(),
          mint: getPlatformTokenMint() || null,
        },
        rates: {
          feePct: PROTOCOL_FEE_PCT,
          devPct: DEV_FEE_PCT,
          buybackPctOfPool: PLATFORM_BUYBACK_PCT_OF_POOL,
          opsPctOfPool: PLATFORM_OPS_PCT_OF_POOL,
          communityPct: COMMUNITY_PCT,
        },
        /** False only when the kill switch is set or no platform token exists. */
        automated: autoBuybackEnabled(),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
