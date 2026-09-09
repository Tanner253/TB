import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import { RektReport } from '@/lib/db/analyticsModels'
import {
  buildRektReport,
  isValidWalletAddress,
  type RektReportData,
} from '@/lib/rekt/rektReport'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Public Rekt Report Card API — heavily cached because every fresh compute
 * spends Helius + DexScreener credits on a wallet with no revenue attached.
 *
 *  - REKT_TOOL_ENABLED=false        → kill switch (503)
 *  - REKT_CACHE_MINUTES (360)       → serve cached report within this window
 *  - REKT_DAILY_COMPUTE_CAP (250)   → max fresh computes per rolling 24h
 */

function toolEnabled(): boolean {
  return process.env.REKT_TOOL_ENABLED?.trim().toLowerCase() !== 'false'
}

function cacheMinutes(): number {
  const n = parseInt(process.env.REKT_CACHE_MINUTES ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : 360
}

function dailyComputeCap(): number {
  const n = parseInt(process.env.REKT_DAILY_COMPUTE_CAP ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : 250
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { wallet: string } }
) {
  try {
    if (!toolEnabled()) {
      return NextResponse.json(
        { success: false, error: 'The Rekt tool is taking a breather. Try again later.' },
        { status: 503 }
      )
    }

    const wallet = decodeURIComponent(params.wallet ?? '').trim()
    if (!isValidWalletAddress(wallet)) {
      return NextResponse.json(
        { success: false, error: 'That does not look like a Solana wallet address.' },
        { status: 400 }
      )
    }

    await connectDB()

    const cached = await RektReport.findOne({ wallet }).lean()
    const freshUntil = Date.now() - cacheMinutes() * 60 * 1000
    if (cached && new Date(cached.computedAt).getTime() > freshUntil) {
      await RektReport.updateOne({ wallet }, { $inc: { views: 1 } }).catch(() => {})
      return NextResponse.json({
        success: true,
        data: { report: cached.report as unknown as RektReportData, cached: true },
      })
    }

    // Budget guard: cap fresh computes per rolling 24h across all wallets.
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const computedToday = await RektReport.countDocuments({ computedAt: { $gt: dayAgo } })
    if (computedToday >= dailyComputeCap()) {
      if (cached) {
        // Better a stale card than no card.
        await RektReport.updateOne({ wallet }, { $inc: { views: 1 } }).catch(() => {})
        return NextResponse.json({
          success: true,
          data: { report: cached.report as unknown as RektReportData, cached: true, stale: true },
        })
      }
      return NextResponse.json(
        {
          success: false,
          error: 'Blasty is out of breath — too many wallets scanned today. Try again tomorrow.',
        },
        { status: 429 }
      )
    }

    const report = await buildRektReport(wallet)

    await RektReport.findOneAndUpdate(
      { wallet },
      {
        $set: { report, computedAt: new Date(report.computedAt) },
        $inc: { views: 1 },
      },
      { upsert: true }
    ).catch(err => {
      // Cache write failing must not eat the response.
      console.warn('[Rekt] Cache write failed:', err instanceof Error ? err.message : err)
    })

    return NextResponse.json({ success: true, data: { report, cached: false } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to build report'
    console.error('[Rekt] Report failed:', message)
    return NextResponse.json(
      { success: false, error: 'Could not scan that wallet right now. Try again shortly.' },
      { status: 500 }
    )
  }
}
