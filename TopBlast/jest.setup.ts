jest.mock('server-only', () => ({}))

/**
 * Jest must never see Atlas / Vercel production credentials.
 * Tests use MongoMemoryServer only (see __tests__/helpers/memoryMongo.ts).
 * There is no deployment-reset / DB-wipe feature in the app.
 */
function assertSafeTestDatabaseEnv() {
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    throw new Error('Refusing to run Jest on Vercel — tests must never execute in deploy builds')
  }

  const mongoUri = process.env.MONGODB_URI?.trim() ?? ''
  if (!mongoUri) return

  const lower = mongoUri.toLowerCase()
  const isLocal =
    lower.includes('127.0.0.1') ||
    lower.includes('localhost') ||
    lower.includes('memory')

  if (!isLocal || lower.includes('mongodb+srv://') || lower.includes('.mongodb.net')) {
    throw new Error(
      'Refusing to run tests: MONGODB_URI must be local/in-memory only. Unset production Atlas URIs.'
    )
  }
}

const SECRET_ENV_KEYS = [
  'PAYOUT_WALLET_PRIVATE_KEY',
  'TENANT_ENCRYPTION_KEY',
  'MASTER_ENCRYPTION_KEY',
  'CRON_SECRET',
  'HELIUS_API_KEY',
  'MONGODB_URI',
  'BIRDEYE_API_KEY',
] as const

assertSafeTestDatabaseEnv()

for (const key of SECRET_ENV_KEYS) {
  delete process.env[key]
}

process.env.SOLANA_NETWORK = 'devnet'
process.env.TENANT_ENCRYPTION_KEY = 'test-encryption-key-for-jest-only'
process.env.VERCEL = ''
process.env.VERCEL_ENV = ''
