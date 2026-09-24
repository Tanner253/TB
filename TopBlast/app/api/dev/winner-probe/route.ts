import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Dev-only: replay the payout's winner resolution step by step.
 *
 * A cycle reporting "No eligible winners" gives no clue which of several
 * chain-reading steps dropped them, and the logs rotate before they can be
 * read. This runs the same calls in the same tenant context and reports where
 * the list empties, so the answer is observed rather than guessed.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production' && process.env.PONS_PROBE_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const slug = request.nextUrl.searchParams.get('slug') ?? 'blasty'
  const out: Record<string, unknown> = { slug }

  try {
    const { runWithTenant } = await import('@/lib/tenant/context')
    const { resolveTenantRuntime } = await import('@/lib/tenant/service')
    const runtime = await resolveTenantRuntime(slug)
    if (!runtime) return NextResponse.json({ error: `no tenant ${slug}` }, { status: 404 })

    return await runWithTenant(runtime, async () => {
      const { config } = await import('@/lib/config')
      out.tokenMint = config.tokenMint
      out.tokenDecimals = config.tokenDecimals
      out.minTokenHolding = config.minTokenHolding
      out.winnerCount = config.winnerCount

      const { loadRankingsFromDb } = await import('@/lib/tracker/holderService')
      const db = await loadRankingsFromDb()
      out.dbRankingRows = db?.rankings?.length ?? 0
      out.dbEligibleCount = db?.eligibleCount ?? 0

      const { resolveLivePayableWinners } = await import('@/lib/payout/executor')
      let winners: { wallet: string }[] = []
      try {
        winners = (await resolveLivePayableWinners(config.winnerCount)) as never
        out.step1_resolveLivePayableWinners = winners.length
        out.step1_winners = winners
      } catch (e) {
        out.step1_error = e instanceof Error ? e.message : String(e)
      }

      try {
        const { getTokenHolders } = await import('@/lib/solana/indexer')
        const holders = await getTokenHolders(config.tokenMint!, 500)
        out.step2_getTokenHolders = holders.length
        out.step2_sample = holders.slice(0, 3)
      } catch (e) {
        out.step2_error = e instanceof Error ? e.message : String(e)
      }

      try {
        const { filterWinnersHoldingSessionToken } = await import('@/lib/payout/payoutSecurity')
        const verified = await filterWinnersHoldingSessionToken(winners as never)
        out.step3_afterOnChainVerification = verified.length
      } catch (e) {
        out.step3_error = e instanceof Error ? e.message : String(e)
      }

      return NextResponse.json({ success: true, ...out })
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e), ...out },
      { status: 500 }
    )
  }
}
