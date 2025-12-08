import * as dotenv from 'dotenv'
import * as path from 'path'

// Load .env.test for test environment
dotenv.config({ path: path.resolve(__dirname, '.env.test') })

// Force devnet for all tests
process.env.SOLANA_NETWORK = 'devnet'

console.log('🧪 Test environment loaded')
console.log(`   Network: ${process.env.SOLANA_NETWORK}`)
console.log(`   Wallet configured: ${process.env.PAYOUT_WALLET_PRIVATE_KEY ? 'Yes' : 'No'}`)

