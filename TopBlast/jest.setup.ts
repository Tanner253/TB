import * as dotenv from 'dotenv'
import * as path from 'path'

jest.mock('server-only', () => ({}))

dotenv.config({ path: path.resolve(__dirname, '.env.test') })

// devnet or mainnet — Solana cluster via SOLANA_NETWORK
process.env.SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'devnet'

console.log('🧪 Test environment loaded')
console.log(`   Network: ${process.env.SOLANA_NETWORK} (Solana)`)
console.log(`   Wallet configured: ${process.env.PAYOUT_WALLET_PRIVATE_KEY ? 'Yes' : 'No'}`)
