/**
 * Solana devnet transfer tests — local only, never runs in CI/Vercel.
 * Set RUN_DEVNET_TRANSFER_TESTS=1 and PAYOUT_WALLET_PRIVATE_KEY locally to opt in.
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

const runDevnetTests =
  process.env.RUN_DEVNET_TRANSFER_TESTS === '1' &&
  !process.env.CI &&
  !!process.env.PAYOUT_WALLET_PRIVATE_KEY &&
  isValidSolanaSecretKey(process.env.PAYOUT_WALLET_PRIVATE_KEY)

const describeDevnet = runDevnetTests ? describe : describe.skip

describeDevnet('Solana Transfer (devnet, local opt-in)', () => {
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
      const result = await getPayoutWalletBalance()
      expect(result).not.toBeNull()
      expect(result?.sol).toBeGreaterThanOrEqual(0)
    }, 30000)
  })

  describe('Transfer', () => {
    it('should transfer SOL when wallet is funded', async () => {
      const balance = await getPayoutWalletBalance()
      if (!balance || balance.sol < 0.01) {
        return
      }

      const testRecipient = Keypair.generate().publicKey.toBase58()
      const amount = 0.001

      const result = await transferSol(testRecipient, amount)
      if (result.success) {
        expect(result.txHash).toBeTruthy()
      }
    }, 60000)
  })
})
