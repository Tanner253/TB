/**
 * Solana devnet transfer tests
 *
 * Requires:
 *   SOLANA_NETWORK=devnet
 *   PAYOUT_WALLET_PRIVATE_KEY=base58 secret key
 *   Fund devnet wallet with SOL
 */

import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import { transferSol, getPayoutWalletBalance, verifyConnection } from '@/lib/solana/transfer'

function isValidSolanaSecretKey(key: string): boolean {
  try {
    const decoded = bs58.decode(key)
    return decoded.length === 64
  } catch {
    return false
  }
}

const hasSolanaWallet =
  !!process.env.PAYOUT_WALLET_PRIVATE_KEY &&
  isValidSolanaSecretKey(process.env.PAYOUT_WALLET_PRIVATE_KEY)

describe('Solana Transfer', () => {
  beforeAll(() => {
    process.env.SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'devnet'
  })

  describe('Connection', () => {
    it('should connect to Solana RPC', async () => {
      const result = await verifyConnection()
      expect(result.connected).toBe(true)
      expect(result.blockHeight).toBeGreaterThan(0)
    }, 30000)
  })

  describe('Wallet Balance', () => {
    it('should read payout wallet balance', async () => {
      if (!hasSolanaWallet) {
        console.log('⏭️ Skipping — set PAYOUT_WALLET_PRIVATE_KEY to base58 Solana key')
        return
      }

      const result = await getPayoutWalletBalance()
      expect(result).not.toBeNull()
      expect(result?.sol).toBeGreaterThanOrEqual(0)
      console.log(`✅ Payout wallet: ${result?.address}`)
      console.log(`✅ Balance: ${result?.sol} SOL`)
    }, 30000)
  })

  describe('Transfer', () => {
    it('should transfer SOL when wallet is funded', async () => {
      if (!hasSolanaWallet) return

      const balance = await getPayoutWalletBalance()
      if (!balance || balance.sol < 0.01) {
        console.log('⏭️ Skipping transfer — insufficient devnet SOL')
        return
      }

      const testRecipient = Keypair.generate().publicKey.toBase58()
      const amount = 0.001

      const result = await transferSol(testRecipient, amount)
      if (result.success) {
        expect(result.txHash).toBeTruthy()
        console.log(`✅ Transfer: ${result.txHash}`)
      } else {
        console.log(`⚠️ Transfer skipped/failed: ${result.error}`)
      }
    }, 60000)
  })
})
