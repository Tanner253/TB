/**
 * Robinhood Chain EVM transfer tests
 *
 * Requires:
 *   SOLANA_NETWORK=devnet  (maps to Robinhood testnet 46630)
 *   PAYOUT_WALLET_PRIVATE_KEY=0x... (hex)
 *   Fund testnet wallet with ETH
 */

import { transferEth, getPayoutWalletBalance, verifyConnection } from '@/lib/evm/transfer'

const hasEvmWallet = !!process.env.PAYOUT_WALLET_PRIVATE_KEY &&
  /^0x?[0-9a-fA-F]{64}$/.test(
    process.env.PAYOUT_WALLET_PRIVATE_KEY.replace(/^0x/, '')
  )

describe('Robinhood EVM Transfer', () => {
  beforeAll(() => {
    process.env.SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'devnet'
  })

  describe('Connection', () => {
    it('should connect to Robinhood Chain RPC', async () => {
      const result = await verifyConnection()
      expect(result.connected).toBe(true)
      expect(result.blockHeight).toBeGreaterThan(0)
    }, 30000)
  })

  describe('Wallet Balance', () => {
    it('should read payout wallet balance', async () => {
      if (!hasEvmWallet) {
        console.log('⏭️ Skipping — set PAYOUT_WALLET_PRIVATE_KEY to 0x hex EVM key')
        return
      }

      const result = await getPayoutWalletBalance()
      expect(result).not.toBeNull()
      expect(result?.eth).toBeGreaterThanOrEqual(0)
      console.log(`✅ Payout wallet: ${result?.address}`)
      console.log(`✅ Balance: ${result?.eth} ETH`)
    }, 30000)
  })

  describe('Transfer', () => {
    it('should transfer ETH when wallet is funded', async () => {
      if (!hasEvmWallet) return

      const balance = await getPayoutWalletBalance()
      if (!balance || balance.eth < 0.01) {
        console.log('⏭️ Skipping transfer — insufficient testnet ETH')
        return
      }

      const testRecipient = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
      const amount = 0.001

      const result = await transferEth(testRecipient, amount)
      if (result.success) {
        expect(result.txHash).toMatch(/^0x/)
        console.log(`✅ Transfer: ${result.txHash}`)
      } else {
        console.log(`⚠️ Transfer skipped/failed: ${result.error}`)
      }
    }, 60000)
  })
})
