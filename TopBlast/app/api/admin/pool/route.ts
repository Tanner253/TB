import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import { PoolBalance } from '@/lib/db/models'
import { config } from '@/lib/config'

export const dynamic = 'force-dynamic'

// Verify admin secret (same as cron secret for simplicity)
function verifyAdminSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false
  
  const token = authHeader.replace('Bearer ', '')
  return token === config.cronSecret
}

// Update pool balance (for manual treasury deposits)
export async function POST(request: NextRequest) {
  // Verify authorization
  if (!verifyAdminSecret(request) && config.isProd) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await connectDB()

    const body = await request.json()
    const { balance_usd, balance_tokens, action } = body

    // Get current pool
    const pool = await PoolBalance.findOne()

    let newBalanceUsd = pool?.balance || 0
    let newBalanceTokens = pool?.balanceTokens || 0

    if (action === 'deposit') {
      // Add to balance
      if (balance_usd !== undefined) newBalanceUsd += parseFloat(balance_usd)
      if (balance_tokens !== undefined) newBalanceTokens += parseInt(balance_tokens)
    } else if (action === 'set') {
      // Set absolute balance
      if (balance_usd !== undefined) newBalanceUsd = parseFloat(balance_usd)
      if (balance_tokens !== undefined) newBalanceTokens = parseInt(balance_tokens)
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use "deposit" or "set"' },
        { status: 400 }
      )
    }

    // Upsert pool balance
    await PoolBalance.findOneAndUpdate(
      {},
      {
        balance: newBalanceUsd,
        balanceTokens: newBalanceTokens,
        lastDepositAt: new Date(),
        updatedAt: new Date(),
      },
      { upsert: true }
    )

    return NextResponse.json({
      success: true,
      data: {
        balance_usd: newBalanceUsd.toFixed(2),
        balance_tokens: newBalanceTokens.toString(),
        action,
      },
    })
  } catch (error) {
    console.error('Error updating pool:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update pool' },
      { status: 500 }
    )
  }
}
