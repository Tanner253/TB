import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import { Holder } from '@/lib/db/models'
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

    // Pool balance comes from on-chain payout wallet via getLivePoolBalance() — not seeded here.
    return NextResponse.json({
      success: true,
      data: {
        pool_seeded: false,
        note: 'Pool is read from payout wallet on-chain; MongoDB PoolBalance is legacy.',
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

