/**
 * Wipe TopBlast protocol collections for a fresh test run.
 * Usage: node scripts/reset-production-db.cjs
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

const mongoose = require('mongoose')

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('MONGODB_URI not set')
  process.exit(1)
}

const COLLECTIONS = [
  'holders',
  'currentrankings',
  'disqualifications',
  'snapshots',
  'payouts',
  'poolbalances',
  'timerstates',
  'pricecaches',
]

async function main() {
  await mongoose.connect(uri)
  const db = mongoose.connection.db
  const results = {}

  for (const name of COLLECTIONS) {
    try {
      const r = await db.collection(name).deleteMany({})
      results[name] = r.deletedCount
    } catch {
      results[name] = 0
    }
  }

  const tokenMint = process.env.TOKEN_MINT_ADDRESS || ''
  if (tokenMint.startsWith('0x')) {
    await db.collection('timerstates').insertOne({
      key: 'payout_timer',
      tokenMint,
      timerStatus: 'waiting',
      lastPayoutTime: null,
      currentCycle: 0,
      failedAttempts: 0,
      isPayoutInProgress: false,
      lockAcquiredAt: null,
      lockCycle: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    results.timer_initialized = tokenMint.slice(0, 12) + '...'
  } else {
    results.timer_initialized =
      'skipped — production will create timer on first /api/leaderboard hit with Vercel TOKEN_MINT_ADDRESS'
  }

  console.log(JSON.stringify({ success: true, cleared: results }, null, 2))
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
