import { NextRequest, NextResponse } from 'next/server'
import { createTenant, listPublicTenants } from '@/lib/tenant/service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const tenants = await listPublicTenants()
    return NextResponse.json({ success: true, data: { tenants } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list tenants'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = await createTenant({
      slug: body.slug,
      mint: body.mint,
      symbol: body.symbol,
      decimals: body.decimals,
      payoutWalletPrivateKey: body.payoutWalletPrivateKey,
      payoutIntervalMinutes: body.payoutIntervalMinutes,
      minTokenHolding: body.minTokenHolding,
    })

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create tenant'
    const status = message.includes('already') ? 409 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
