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
    // The resolver never touches the payout key, so a runtime built from the
    // tenant document alone is enough to replay it — which lets this run on a
    // machine that cannot decrypt the key (any dev box) against the shared DB.
    let runtime: Awaited<ReturnType<typeof resolveTenantRuntime>> = null
    try {
      runtime = await resolveTenantRuntime(slug)
    } catch (e) {
      out.runtimeDecryptError = e instanceof Error ? e.message : String(e)
      const { Tenant } = await import('@/lib/db/models')
      const connectDB = (await import('@/lib/db')).default
      await connectDB()
      const doc = await Tenant.findOne({ slug }).lean()
      if (doc) {
        runtime = {
          tenantSlug: doc.slug,
          tokenMint: doc.mint,
          tokenSymbol: doc.symbol,
          tokenDecimals: doc.decimals,
          devWalletAddress: process.env.DEV_WALLET_ADDRESS ?? '',
          payoutIntervalMinutes: doc.payoutIntervalMinutes,
          winnerCount: doc.winnerCount ?? 3,
          minTokenHolding: doc.minTokenHolding,
          minLossThresholdPct: doc.minLossThresholdPct,
          minPoolSol: doc.minPoolSol,
          minPoolEth: doc.minPoolSol,
          executePayouts: false,
          payoutMode: doc.payoutMode ?? 'token',
          payoutWalletPrivateKey: '',
        }
        out.runtimeSource = 'tenant-doc-without-key'
      }
    }
    if (!runtime) return NextResponse.json({ error: `no tenant ${slug}`, ...out }, { status: 404 })

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

      // Replay resolveLivePayableWinners stage by stage: the eligibility rules
      // already pass for the winner, so the holder is being dropped by one of
      // the steps around them.
      try {
        const { loadRankingsFromDb: load3 } = await import('@/lib/tracker/holderService')
        const { getTokenHolders: gth } = await import('@/lib/solana/indexer')
        const { mergeLiveHolderBalances } = await import('@/lib/leaderboard/mergeLiveHolderBalances')
        const { isExcludedParticipantWallet } = await import('@/lib/eligibility/excludedWallets')
        const { isLiquidityPoolWallet, ensureLiquidityPoolAddresses } = await import('@/lib/eligibility/liquidityPools')
        const snap = await load3()
        const map = new Map((snap?.rankings ?? []).map((h: Record<string, unknown>) => [h.wallet as string, { ...h }]))
        out.stageA_dbRows = map.size
        await ensureLiquidityPoolAddresses(config.tokenMint!)
        const live = await gth(config.tokenMint!, 1000)
        out.stageB_liveHolders = live.length
        mergeLiveHolderBalances(map as never, live, config.tokenMint!)
        out.stageC_afterMerge = map.size
        const contractWallets = new Set(live.filter(h => h.isContract).map(h => h.wallet))
        out.stageC_contractCount = contractWallets.size
        const dropped: Record<string, number> = { isContract: 0, inContractSet: 0, excluded: 0, lpWallet: 0 }
        let kept = 0
        for (const h of map.values()) {
          const row = h as Record<string, unknown>
          const w = row.wallet as string
          if (row.isContract) { dropped.isContract++; continue }
          if (contractWallets.has(w)) { dropped.inContractSet++; continue }
          if (isExcludedParticipantWallet(w)) { dropped.excluded++; continue }
          if (isLiquidityPoolWallet(w, config.tokenMint!)) { dropped.lpWallet++; continue }
          kept++
        }
        out.stageD_survivedFilter = kept
        out.stageD_dropReasons = dropped

        // Same evaluation the resolver runs, with the resolver's real inputs.
        const { evaluateHolderEligibility: ev } = await import('@/lib/eligibility/evaluateHolder')
        const { getLivePoolBalance: pool2 } = await import('@/lib/payout/poolBalance')
        const { getTokenPrice: price2 } = await import('@/lib/solana/price')
        const { normalizeTokenBalance: norm } = await import('@/lib/solana/tokenAmount')
        const { getCurrentPayoutCycle } = await import('@/lib/payout/executor')
        const { loadLastWinCycleByWallet } = await import('@/lib/payout/winnerPersistence')
        const lp = await pool2()
        const tp = (await price2(config.tokenMint!)) ?? snap?.tokenPrice ?? 0
        const cyc = getCurrentPayoutCycle()
        const lastWin = await loadLastWinCycleByWallet([...map.keys()])
        out.resolverTokenPrice = tp
        out.resolverPoolUsd = lp.poolUsd
        out.resolverCurrentCycle = cyc
        const why: Record<string, number> = {}
        const samples: unknown[] = []
        for (const h of map.values()) {
          const row = h as Record<string, unknown>
          const r = ev({
            wallet: row.wallet as string,
            balance: norm(row.balance as number, config.tokenDecimals, config.minTokenHolding),
            vwap: (row.vwap as number) || null,
            tokenPrice: tp,
            firstBuyTimestamp: row.firstBuyAt ? new Date(row.firstBuyAt as string).getTime() : null,
            hasSold: (row.hasSold as boolean) ?? false,
            hasTransferredOut: (row.hasTransferredOut as boolean) ?? false,
            hasTransferIn: (row.hasTransferIn as boolean) ?? false,
            lastWinCycle: lastWin.get(row.wallet as string) ?? (row.lastWinCycle as number) ?? null,
            totalTokensBought: (row.totalTokensBought as number) ?? 0,
            poolUsd: lp.poolUsd,
            currentCycle: cyc,
          })
          const key = r.isEligible ? 'ELIGIBLE' : String(r.ineligibleReason)
          why[key] = (why[key] ?? 0) + 1
          if (samples.length < 3) samples.push({ w: String(row.wallet).slice(0, 12), bal: row.balance, vwap: row.vwap, elig: r.isEligible, why: r.ineligibleReason, loss: r.lossUsd })
        }
        out.resolverVerdictCounts = why
        out.resolverSamples = samples
      } catch (e) {
        out.stageError = e instanceof Error ? e.message : String(e)
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
