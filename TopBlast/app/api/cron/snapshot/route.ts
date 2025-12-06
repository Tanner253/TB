import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import { Holder, Snapshot, PoolBalance, Disqualification } from '@/lib/db/models'
import { getTokenHolders } from '@/lib/solana/helius'
import { getTokenPrice } from '@/lib/solana/price'
import { calculateBatchVwaps, VwapData } from '@/lib/tracker/vwap'
import { calculateDrawdown, calculateLossUsd, rankHolders, RankedHolder } from '@/lib/engine/calculations'
import { config, validateConfig } from '@/lib/config'

// Verify cron secret
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false
  const token = authHeader.replace('Bearer ', '')
  return token === config.cronSecret
}

// Allow GET requests in development for easier testing
export async function GET(request: NextRequest) {
  if (config.isProd) {
    return NextResponse.json({ error: 'Use POST in production' }, { status: 405 })
  }
  return runSnapshot(request)
}

export async function POST(request: NextRequest) {
  // Verify authorization (skip in development)
  if (!verifyCronSecret(request) && config.isProd) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runSnapshot(request)
}

async function runSnapshot(_request: NextRequest) {

  // Validate configuration
  const configCheck = validateConfig()
  if (!configCheck.valid) {
    return NextResponse.json({
      success: false,
      error: 'Configuration error',
      details: configCheck.errors,
    }, { status: 500 })
  }

  try {
    await connectDB()
    
    console.log(`[Snapshot] Starting hourly snapshot for ${config.tokenSymbol}`)
    console.log(`[Snapshot] Token: ${config.tokenMint}`)

    // 1. Get current token price (REAL from Jupiter)
    const tokenPrice = await getTokenPrice(config.tokenMint)
    if (!tokenPrice) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch token price from Jupiter',
      }, { status: 500 })
    }
    console.log(`[Snapshot] Price: $${tokenPrice}`)

    // 2. Get pool balance from database
    const pool = await PoolBalance.findOne()
    const poolBal = pool?.balance || config.poolBalanceUsd
    console.log(`[Snapshot] Pool: $${poolBal}`)

    // 3. Get current cycle number
    const lastSnapshot = await Snapshot.findOne().sort({ cycle: -1 })
    const currentCycle = (lastSnapshot?.cycle || 0) + 1
    console.log(`[Snapshot] Cycle: ${currentCycle}`)

    // 4. Remove expired disqualifications
    await Disqualification.deleteMany({ expiresAt: { $lt: new Date() } })

    // 5. Fetch ALL token holders (REAL from Helius)
    const rawHolders = await getTokenHolders(config.tokenMint, config.maxHoldersToProcess)
    console.log(`[Snapshot] Found ${rawHolders.length} holders`)

    if (rawHolders.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No holders found - verify TOKEN_MINT_ADDRESS and HELIUS_API_KEY',
      }, { status: 500 })
    }

    // Convert balances to human readable
    const holders = rawHolders.map(h => ({
      wallet: h.wallet,
      balance: h.balance / Math.pow(10, config.tokenDecimals),
      balanceRaw: h.balance,
    }))

    // 6. Get active disqualifications
    const activeDqs = await Disqualification.find()
    const dqWallets = new Set(activeDqs.map(d => d.wallet))

    // 7. Calculate REAL VWAPs from on-chain transaction history
    console.log(`[Snapshot] Fetching transaction history for VWAP calculation...`)
    const walletAddresses = holders.map(h => h.wallet)
    const vwapMap = await calculateBatchVwaps(walletAddresses, config.tokenMint, tokenPrice, 5)

    // 8. Process each holder - determine eligibility based on REAL data
    const rankedHolders: RankedHolder[] = []
    let processedCount = 0

    for (const holder of holders) {
      processedCount++

      // Skip disqualified wallets
      if (dqWallets.has(holder.wallet)) {
        await updateHolder(holder.wallet, holder.balance, null, false, 'Disqualified')
        continue
      }

      // Get REAL VWAP from transaction history
      const vwapData = vwapMap.get(holder.wallet)

      // No buy history = not eligible
      if (!vwapData || !vwapData.vwap || vwapData.buyCount === 0) {
        await updateHolder(holder.wallet, holder.balance, null, false, 'No buy history')
        continue
      }

      // Sold tokens = disqualified
      if (vwapData.hasSold) {
        await updateHolder(holder.wallet, holder.balance, vwapData.vwap, false, 'Sold tokens')
        continue
      }

      // Check minimum balance
      if (holder.balance < config.minTokenHolding) {
        await updateHolder(holder.wallet, holder.balance, vwapData.vwap, false, 'Insufficient balance')
        continue
      }

      // Check hold duration
      if (vwapData.firstBuyTimestamp) {
        const holdMs = Date.now() - vwapData.firstBuyTimestamp
        const minHoldMs = config.minHoldDurationHours * 60 * 60 * 1000
        if (holdMs < minHoldMs) {
          await updateHolder(holder.wallet, holder.balance, vwapData.vwap, false, 'Hold duration not met')
          continue
        }
      }

      // Calculate drawdown (REAL: current price vs VWAP)
      const drawdownPct = calculateDrawdown(vwapData.vwap, tokenPrice)

      // Must be in loss position
      if (drawdownPct >= 0) {
        await updateHolder(holder.wallet, holder.balance, vwapData.vwap, false, 'In profit')
        continue
      }

      // Calculate USD loss
      const lossUsd = calculateLossUsd(vwapData.vwap, tokenPrice, holder.balance)

      // Check minimum loss threshold
      const minLoss = poolBal * (config.minLossThresholdPct / 100)
      if (lossUsd < minLoss) {
        await updateHolder(holder.wallet, holder.balance, vwapData.vwap, false, 'Loss below threshold')
        continue
      }

      // Check winner cooldown
      const dbHolder = await Holder.findOne({ wallet: holder.wallet })
      if (dbHolder?.lastWinCycle && dbHolder.lastWinCycle >= currentCycle - 1) {
        await updateHolder(holder.wallet, holder.balance, vwapData.vwap, false, 'Winner cooldown')
        continue
      }

      // ✅ ELIGIBLE - Add to rankings
      rankedHolders.push({
        wallet: holder.wallet,
        balance: holder.balance,
        vwap: vwapData.vwap,
        currentPrice: tokenPrice,
        drawdownPct,
        lossUsd,
        rank: 0,
        isEligible: true,
        ineligibleReason: null,
      })

      await updateHolder(holder.wallet, holder.balance, vwapData.vwap, true, null, vwapData)
    }

    console.log(`[Snapshot] Processed ${processedCount} holders, ${rankedHolders.length} eligible`)

    // 9. Rank by drawdown % (most negative first), tiebreaker: USD loss
    const ranked = rankHolders(rankedHolders)

    // 10. Save snapshot to database
    const snapshot = await Snapshot.create({
      cycle: currentCycle,
      timestamp: new Date(),
      tokenPrice,
      poolBalance: poolBal,
      totalHolders: holders.length,
      eligibleCount: ranked.length,
      rankings: ranked.slice(0, 50),
    })

    // 11. Log winners
    const top3 = ranked.slice(0, 3).map(h => ({
      rank: h.rank,
      wallet: h.wallet,
      wallet_short: `${h.wallet.slice(0, 4)}...${h.wallet.slice(-4)}`,
      drawdown_pct: Math.round(h.drawdownPct * 100) / 100,
      loss_usd: h.lossUsd.toFixed(2),
      vwap: h.vwap.toFixed(10),
    }))

    console.log(`[Snapshot] ✅ Cycle ${currentCycle} complete`)
    if (top3.length > 0) {
      console.log(`[Snapshot] Winners:`)
      top3.forEach(w => console.log(`  #${w.rank}: ${w.wallet_short} | ${w.drawdown_pct}% | $${w.loss_usd}`))
    } else {
      console.log(`[Snapshot] No eligible winners this cycle`)
    }

    return NextResponse.json({
      success: true,
      data: {
        cycle: currentCycle,
        token: config.tokenSymbol,
        token_mint: config.tokenMint,
        token_price: tokenPrice,
        pool_balance: poolBal,
        total_holders: holders.length,
        eligible_count: ranked.length,
        winners: top3,
        snapshot_id: snapshot._id.toString(),
      },
    })
  } catch (error: any) {
    console.error('[Snapshot] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Snapshot failed',
    }, { status: 500 })
  }
}

// Helper to update holder in database
async function updateHolder(
  wallet: string,
  balance: number,
  vwap: number | null,
  isEligible: boolean,
  ineligibleReason: string | null,
  vwapData?: VwapData
) {
  await Holder.findOneAndUpdate(
    { wallet },
    {
      wallet,
      balance,
      vwap,
      totalBought: vwapData?.totalTokensBought || 0,
      totalCostBasis: vwapData?.totalCostBasis || 0,
      firstBuyAt: vwapData?.firstBuyTimestamp ? new Date(vwapData.firstBuyTimestamp) : null,
      lastActivityAt: vwapData?.lastActivityTimestamp ? new Date(vwapData.lastActivityTimestamp) : null,
      isEligible,
      ineligibleReason,
      updatedAt: new Date(),
    },
    { upsert: true }
  )
}
