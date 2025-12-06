import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import { Holder, PoolBalance } from '@/lib/db/models'
import { config } from '@/lib/config'

export const dynamic = 'force-dynamic'

// Seed test data for development
export async function POST(request: NextRequest) {
  // Only allow in development
  if (config.isProd) {
    return NextResponse.json(
      { success: false, error: 'Seed endpoint only available in development' },
      { status: 403 }
    )
  }

  try {
    await connectDB()

    // Seed pool balance
    const existingPool = await PoolBalance.findOne()

    if (!existingPool) {
      await PoolBalance.create({
        balance: config.poolBalanceUsd,
        balanceTokens: config.poolBalanceTokens,
        totalDistributed: 0,
        totalCycles: 0,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        pool_seeded: true,
      },
    })
  } catch (error) {
    console.error('Error seeding data:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to seed data' },
      { status: 500 }
    )
  }
}

