import { NextResponse } from 'next/server'
import { tenantRoute } from '@/lib/tenant/tenantRoute'
import { getTenantDiagnostics } from '@/lib/tenant/getTenantDiagnostics'
import { config } from '@/lib/config'
import { formatPayoutInterval } from '@/lib/platform/payoutIntervals'

export const dynamic = 'force-dynamic'

async function handleStatus() {
  const diagnostics = await getTenantDiagnostics()
  return NextResponse.json({
    success: true,
    data: {
      slug: config.tenantSlug,
      token_symbol: config.tokenSymbol,
      token_mint: config.tokenMint,
      payout_interval_minutes: config.payoutIntervalMinutes,
      payout_interval_display: formatPayoutInterval(config.payoutIntervalMinutes),
      diagnostics,
    },
  })
}

export const GET = tenantRoute(() => handleStatus())
