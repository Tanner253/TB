import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Dev-only diagnostic for the Robinhood Chain / Pons migration.
 * Exercises the real lib/pons modules against live chain data so we can
 * validate indexing and fee reads before wiring the payout engine.
 *
 * Disabled in production unless PONS_PROBE_ENABLED=true.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production' && process.env.PONS_PROBE_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const token = request.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'pass ?token=0x…' }, { status: 400 })

  const blocks = parseInt(request.nextUrl.searchParams.get('blocks') ?? '300000', 10)

  try {
    const { getPonsLaunch, getCurveState, getGraduationProgress } = await import('@/lib/pons/launch')
    const { getPendingFees } = await import('@/lib/pons/fees')
    const { indexLaunchHolders } = await import('@/lib/pons/holderIndex')
    const { quoteCurveBuy } = await import('@/lib/pons/buyback')
    const { latestBlock } = await import('@/lib/evm/logReader')

    const t0 = Date.now()
    const launch = await getPonsLaunch(token)
    if (!launch) {
      return NextResponse.json({ success: false, error: 'Not a Pons v2 launch' }, { status: 404 })
    }

    const head = await latestBlock()
    const from = head - BigInt(blocks)

    const [curve, progress, pending, index] = await Promise.all([
      getCurveState(launch.curve),
      getGraduationProgress(launch),
      getPendingFees(token, launch.creatorFeeRecipient),
      indexLaunchHolders({ tokenAddress: token, launchBlock: from, fromBlock: from }),
    ])

    // Quote a 0.01 ETH buyback the way the payout engine would.
    const quote = launch.onCurve
      ? await quoteCurveBuy(launch.curve, 10_000_000_000_000_000n, launch.creatorFeeRecipient)
      : null

    const holders = index?.holders ?? []
    const withVwap = holders.filter(h => h.vwap != null)

    return NextResponse.json({
      success: true,
      elapsedMs: Date.now() - t0,
      launch: {
        token: launch.token,
        curve: launch.curve,
        creatorFeeRecipient: launch.creatorFeeRecipient,
        pairToken: launch.pairToken,
        nativeQuote: launch.nativeQuote,
        phase: launch.phase,
        venue: launch.onCurve ? 'bonding-curve' : launch.onUniswapV4 ? 'uniswap-v4' : 'transitional',
        creatorTaxBps: launch.creatorTaxBps,
      },
      graduation: progress
        ? { pct: progress.pct, paired: progress.pairedQuote.toString(), threshold: progress.threshold.toString() }
        : null,
      curveReserves: curve
        ? {
            quoteReserve: curve.quoteReserve.toString(),
            realQuoteReserve: curve.realQuoteReserve.toString(),
            sellableTokens: curve.sellableTokens.toString(),
            feeBps: curve.feeBps.toString(),
          }
        : null,
      pendingCreatorFees: pending
        ? { nativeWei: pending.nativeWei.toString(), tokenAmount: pending.tokenAmount.toString() }
        : null,
      buybackQuote: quote
        ? { tokensOut: quote.tokensOut.toString(), minTokensOut: quote.minTokensOut.toString(), fee: quote.feeAmount.toString() }
        : null,
      indexing: {
        blocksRequested: blocks,
        lastIndexedBlock: index?.lastIndexedBlock ?? null,
        incomplete: index?.incomplete ?? null,
        holderCount: holders.length,
        holdersWithVwap: withVwap.length,
        topHolders: holders.slice(0, 8).map(h => ({
          wallet: h.wallet,
          balance: h.balance,
          vwap: h.vwap,
          spent: h.totalQuoteSpent,
          bought: h.totalTokensBought,
          hasSold: h.hasSold,
          hasTransferIn: h.hasTransferIn,
          firstBuyAt: h.firstBuyAt,
        })),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[PonsProbe]', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
