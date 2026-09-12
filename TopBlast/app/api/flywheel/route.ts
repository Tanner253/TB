import { NextResponse } from 'next/server'
import { getFlywheelStats } from '@/lib/platform/flywheelStats'
import {
  DEV_FEE_PCT,
  PLATFORM_BUYBACK_PCT_OF_POOL,
  PLATFORM_OPS_PCT_OF_POOL,
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
          feePct: DEV_FEE_PCT,
          buybackPctOfPool: PLATFORM_BUYBACK_PCT_OF_POOL,
          opsPctOfPool: PLATFORM_OPS_PCT_OF_POOL,
        },
        /** False when fees accrue but nothing buys automatically yet. */
        automated: autoBuybackEnabled(),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
