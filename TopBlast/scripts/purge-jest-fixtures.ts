/**
 * Usage: npx tsx scripts/purge-jest-fixtures.ts
 * Loads MONGODB_URI from .env.local first, then .env (never logs secrets).
 */

import dotenv from 'dotenv'
import mongoose from 'mongoose'
import path from 'path'
import { purgeAllJestFixtureTenants } from '../lib/admin/purgeJestFixtures'

if (!process.env.MONGODB_URI?.trim()) {
  dotenv.config({ path: path.resolve(__dirname, '../.env.local'), quiet: true })
  dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true })
}

async function main() {
  const uri = process.env.MONGODB_URI?.trim()
  if (!uri) {
    console.error('MONGODB_URI is not set in .env.local or .env')
    process.exit(1)
  }

  await mongoose.connect(uri)
  const purged = await purgeAllJestFixtureTenants()

  if (purged.length === 0) {
    console.log('No Jest test fixture tenants found.')
  } else {
    for (const row of purged) {
      console.log(`Purged "${row.slug}":`, JSON.stringify(row))
    }
  }

  await mongoose.disconnect()
  console.log('Done.')
}

main().catch(err => {
  console.error('Purge failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
