import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '.env.test') })

// devnet → Robinhood testnet (46630), mainnet → 4663
process.env.SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'devnet'

console.log('🧪 Test environment loaded')
console.log(`   Network: ${process.env.SOLANA_NETWORK} (Robinhood EVM)`)
console.log(`   Wallet configured: ${process.env.PAYOUT_WALLET_PRIVATE_KEY ? 'Yes' : 'No'}`)
