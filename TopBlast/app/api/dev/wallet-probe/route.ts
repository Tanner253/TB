import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Dev-only check that lib/pons/wallet.ts works against live chain data —
 * the EVM replacement for Solana's getTokenAccountsByOwner, which the Rekt
 * Report Card depends on. Exercises the real module, not a copy of it.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production' && process.env.PONS_PROBE_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const wallet = request.nextUrl.searchParams.get('wallet')
  if (!wallet) return NextResponse.json({ error: 'pass ?wallet=0x…' }, { status: 400 })

  try {
    const { discoverWalletTokens, getWalletBalances, getWalletCostBasis } = await import(
      '@/lib/pons/wallet'
    )

    const t0 = Date.now()
    const candidates = await discoverWalletTokens(wallet)
    const tDiscover = Date.now() - t0

    const t1 = Date.now()
    const bags = await getWalletBalances(wallet, candidates)
    const tBalances = Date.now() - t1

    // Cost basis is the expensive part, so only the top few — same budget
    // discipline the Rekt card itself uses.
    const t2 = Date.now()
    const withBasis = []
    for (const bag of bags.slice(0, 4)) {
      const basis = await getWalletCostBasis(wallet, bag.token, bag.decimals)
      withBasis.push({
        token: bag.token,
        symbol: bag.symbol,
        balance: bag.balance,
        decimals: bag.decimals,
        vwapEth: basis.vwap,
        buyCount: basis.buyCount,
        spentEth: basis.totalQuoteSpent,
        firstBuyAt: basis.firstBuyAt,
        hasSold: basis.hasSold,
      })
    }
    const tBasis = Date.now() - t2

    return NextResponse.json({
      success: true,
      wallet,
      timingMs: { discover: tDiscover, balances: tBalances, costBasis: tBasis, total: Date.now() - t0 },
      candidateTokens: candidates.length,
      heldBags: bags.length,
      topBags: withBasis,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[WalletProbe]', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
