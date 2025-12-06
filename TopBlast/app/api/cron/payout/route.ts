import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import { Snapshot, Payout, PoolBalance, Holder, Disqualification } from '@/lib/db/models'
import { transferTokens } from '@/lib/solana/transfer'
import { getTokenPrice } from '@/lib/solana/price'
import { config } from '@/lib/config'
import { markWinnersCooldown, resetWinnerVwap } from '@/lib/tracker/holderService'

// Verify cron secret
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false
  const token = authHeader.replace('Bearer ', '')
  return token === config.cronSecret
}

export async function POST(request: NextRequest) {
  // Verify authorization (skip in development)
  if (!verifyCronSecret(request) && config.isProd) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await connectDB()
    
    console.log(`[Payout] Starting hourly payout for ${config.tokenSymbol}`)
    console.log(`[Payout] Execute transfers: ${config.executePayouts}`)

    // 1. Get latest snapshot
    const snapshot = await Snapshot.findOne().sort({ cycle: -1 })
    if (!snapshot) {
      return NextResponse.json({
        success: false,
        error: 'No snapshot available - run /api/cron/snapshot first',
      }, { status: 400 })
    }

    const cycle = snapshot.cycle
    console.log(`[Payout] Processing cycle ${cycle}`)

    // 2. Check if already processed
    const existingPayouts = await Payout.find({ cycle })
    if (existingPayouts.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Cycle ${cycle} already processed`,
        data: { existing_payouts: existingPayouts.length },
      }, { status: 400 })
    }

    // 3. Get pool balance
    const pool = await PoolBalance.findOne()
    const poolBal = pool?.balance || config.poolBalanceUsd
    const poolTokens = pool?.balanceTokens || config.poolBalanceTokens

    console.log(`[Payout] Pool: $${poolBal} (${poolTokens} tokens)`)

    // 4. Check minimum pool
    if (poolBal < config.minPoolForPayout) {
      console.log(`[Payout] Pool below minimum ($${config.minPoolForPayout}), skipping`)
      return NextResponse.json({
        success: true,
        data: {
          cycle,
          skipped: true,
          reason: `Pool ($${poolBal}) below minimum ($${config.minPoolForPayout})`,
        },
      })
    }

    // 5. Get winners from snapshot
    const rankings = snapshot.rankings as any[]
    const winners = rankings.slice(0, 3)

    if (winners.length === 0) {
      console.log('[Payout] No eligible winners')
      return NextResponse.json({
        success: true,
        data: { cycle, skipped: true, reason: 'No eligible winners' },
      })
    }

    // 6. Get current price
    const tokenPrice = await getTokenPrice(config.tokenMint) || snapshot.tokenPrice

    // 7. Calculate payouts (80/15/5)
    const payoutAmounts = [
      poolBal * config.payoutSplit.first,
      poolBal * config.payoutSplit.second,
      poolBal * config.payoutSplit.third,
    ]

    // 8. Process each winner
    const results = []
    let totalPaidUsd = 0
    let totalPaidTokens = 0

    for (let i = 0; i < winners.length; i++) {
      const winner = winners[i]
      const amountUsd = payoutAmounts[i]
      const amountTokens = tokenPrice > 0 ? Math.floor(amountUsd / tokenPrice) : 0

      console.log(`[Payout] #${i + 1}: ${winner.wallet.slice(0, 8)}... | $${amountUsd.toFixed(2)}`)

      let txResult: { success: boolean; txHash: string | null; error: string | null }

      if (config.executePayouts) {
        // EXECUTE REAL TRANSFER
        txResult = await transferTokens(winner.wallet, amountTokens)
        console.log(`[Payout] Transfer: ${txResult.success ? txResult.txHash : 'FAILED'}`)
      } else {
        // LOG ONLY - No actual transfer
        txResult = {
          success: true,
          txHash: `PENDING_${cycle}_${i + 1}_${Date.now()}`,
          error: null,
        }
        console.log(`[Payout] Logged (transfer pending): ${txResult.txHash}`)
      }

      // Save payout record to database
      await Payout.create({
        cycle,
        rank: i + 1,
        wallet: winner.wallet,
        amount: amountUsd,
        amountTokens,
        drawdownPct: winner.drawdownPct,
        lossUsd: winner.lossUsd,
        txHash: txResult.txHash,
        status: config.executePayouts ? (txResult.success ? 'success' : 'failed') : 'pending',
        errorMessage: txResult.error,
      })

      results.push({
        rank: i + 1,
        wallet: winner.wallet,
        wallet_display: `${winner.wallet.slice(0, 4)}...${winner.wallet.slice(-4)}`,
        amount_usd: amountUsd.toFixed(2),
        amount_tokens: amountTokens,
        drawdown_pct: Math.round(winner.drawdownPct * 100) / 100,
        tx_hash: txResult.txHash,
        status: config.executePayouts ? (txResult.success ? 'success' : 'failed') : 'pending',
      })

      if (txResult.success) {
        totalPaidUsd += amountUsd
        totalPaidTokens += amountTokens

        // Add winner cooldown (1 cycle) - always do this
        await Disqualification.create({
          wallet: winner.wallet,
          reason: 'winner_cooldown',
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        })

        // Update Holder's lastWinCycle (for cooldown) - always do this
        await Holder.findOneAndUpdate(
          { wallet: winner.wallet },
          { lastWinCycle: cycle, updatedAt: new Date() }
        )

        // ALWAYS reset VWAP when selected as winner (both demo AND production)
        // This ensures winners start fresh and can't win again until they have new losses
        // Game theory: After winning, your PNL resets to 0%. You can only win again
        // if the price drops BELOW your new cost basis (current price at win time)
        await Holder.findOneAndUpdate(
          { wallet: winner.wallet },
          { vwap: tokenPrice }
        )
        // Reset VWAP in in-memory service
        resetWinnerVwap(winner.wallet)
        console.log(`[Payout] Winner ${winner.wallet.slice(0, 8)}... VWAP reset to $${tokenPrice} - starts fresh`)
      }
    }

    // Mark winners with cooldown in the in-memory holder service
    const winnerWallets = winners.map((w: any) => w.wallet)
    markWinnersCooldown(winnerWallets, cycle)

    // 9. Update pool balance (only if transfers executed)
    if (config.executePayouts) {
      await PoolBalance.findOneAndUpdate(
        {},
        {
          balance: Math.max(0, poolBal - totalPaidUsd),
          balanceTokens: Math.max(0, poolTokens - totalPaidTokens),
          totalDistributed: (pool?.totalDistributed || 0) + totalPaidUsd,
          totalCycles: (pool?.totalCycles || 0) + 1,
          lastPayoutAt: new Date(),
        },
        { upsert: true }
      )
    } else {
      // Just increment cycle count
      await PoolBalance.findOneAndUpdate(
        {},
        {
          totalCycles: (pool?.totalCycles || 0) + 1,
          lastPayoutAt: new Date(),
        },
        { upsert: true }
      )
    }

    console.log(`[Payout] ✅ Cycle ${cycle} complete | ${results.length} winners | $${totalPaidUsd.toFixed(2)}`)

    return NextResponse.json({
      success: true,
      data: {
        cycle,
        token: config.tokenSymbol,
        pool_before: poolBal.toFixed(2),
        pool_after: config.executePayouts ? (poolBal - totalPaidUsd).toFixed(2) : poolBal.toFixed(2),
        total_paid_usd: totalPaidUsd.toFixed(2),
        total_paid_tokens: totalPaidTokens,
        transfers_executed: config.executePayouts,
        payouts: results,
      },
    })
  } catch (error: any) {
    console.error('[Payout] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Payout failed',
    }, { status: 500 })
  }
}
