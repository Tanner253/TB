/**
 * Devnet Transfer Tests
 * 
 * These tests verify SOL transfers work on Solana devnet.
 * 
 * SETUP REQUIRED:
 * 1. Create .env.test with:
 *    SOLANA_NETWORK=devnet
 *    PAYOUT_WALLET_PRIVATE_KEY=<your devnet wallet private key in base58>
 * 
 * 2. Fund your devnet wallet at https://faucet.solana.com
 * 
 * RUN:
 *   npm test -- transfer-devnet.test.ts
 */

import { transferSol, getPayoutWalletBalance, verifyConnection } from '@/lib/solana/transfer'
import { Keypair } from '@solana/web3.js'

// Set devnet for these tests
beforeAll(() => {
  process.env.SOLANA_NETWORK = 'devnet'
})

describe('Solana Transfer - Devnet', () => {
  
  describe('verifyConnection', () => {
    it('should connect to devnet', async () => {
      const result = await verifyConnection()
      
      expect(result.connected).toBe(true)
      expect(result.network).toBe('devnet')
      expect(result.blockHeight).toBeGreaterThan(0)
      
      console.log(`✅ Connected to devnet at block ${result.blockHeight}`)
    }, 15000)
  })

  describe('getPayoutWalletBalance', () => {
    it('should return wallet balance', async () => {
      const result = await getPayoutWalletBalance()
      
      expect(result).not.toBeNull()
      expect(result?.sol).toBeGreaterThanOrEqual(0)
      expect(result?.address).toBeTruthy()
      
      console.log(`✅ Payout wallet: ${result?.address}`)
      console.log(`✅ Balance: ${result?.sol} SOL`)
      
      // Warn if balance is low
      if (result && result.sol < 0.1) {
        console.warn('⚠️ Low balance! Get more devnet SOL from https://faucet.solana.com')
      }
    }, 15000)
  })

  describe('transferSol', () => {
    // Generate a random recipient for testing
    const testRecipient = Keypair.generate().publicKey.toBase58()
    
    it('should reject transfer with invalid recipient', async () => {
      const result = await transferSol('invalid-address', 0.001)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid recipient')
    })

    it('should reject transfer with zero amount', async () => {
      const result = await transferSol(testRecipient, 0)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Amount must be greater than 0')
    })

    it('should reject transfer with negative amount', async () => {
      const result = await transferSol(testRecipient, -1)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Amount must be greater than 0')
    })

    it('should successfully transfer SOL to a new wallet', async () => {
      // Skip if wallet doesn't have enough balance
      const balance = await getPayoutWalletBalance()
      if (!balance || balance.sol < 0.01) {
        console.log('⏭️ Skipping transfer test - insufficient balance')
        console.log('   Fund your wallet at https://faucet.solana.com')
        return
      }

      const amountToSend = 0.001 // 0.001 SOL = small test amount
      
      console.log(`\n📤 Sending ${amountToSend} SOL to ${testRecipient.slice(0, 8)}...`)
      
      const result = await transferSol(testRecipient, amountToSend)
      
      expect(result.success).toBe(true)
      expect(result.txHash).toBeTruthy()
      expect(result.error).toBeNull()
      
      console.log(`✅ Transfer successful!`)
      console.log(`   TX: https://explorer.solana.com/tx/${result.txHash}?cluster=devnet`)
    }, 30000) // 30 second timeout for blockchain confirmation
  })

  describe('Full Payout Simulation with Dev Fee', () => {
    it('should simulate paying dev fee + 3 winners', async () => {
      // Check balance first
      const balance = await getPayoutWalletBalance()
      if (!balance || balance.sol < 0.1) {
        console.log('⏭️ Skipping full payout simulation - need at least 0.1 SOL')
        return
      }

      // Use 0.04 SOL pool to ensure all payouts exceed rent minimum
      // Structure: 5% dev fee, then 80/15/5 split of remaining 95%
      const poolSol = 0.04
      const devFeePct = 0.05
      const devFeeSol = poolSol * devFeePct // 0.002 SOL
      const remainingPool = poolSol - devFeeSol // 0.038 SOL

      // Dev wallet (random for test)
      const devWallet = Keypair.generate().publicKey.toBase58()
      
      // Winner wallets
      const winners = [
        { address: Keypair.generate().publicKey.toBase58(), pct: 0.80 }, // 80% of 95% = 76%
        { address: Keypair.generate().publicKey.toBase58(), pct: 0.15 }, // 15% of 95% = 14.25%
        { address: Keypair.generate().publicKey.toBase58(), pct: 0.05 }, // 5% of 95% = 4.75%
      ]

      console.log(`\n🏆 Simulating payout of ${poolSol} SOL pool:`)
      console.log(`   Dev fee: ${devFeeSol} SOL (5%)`)
      console.log(`   Winners pool: ${remainingPool} SOL (95%)`)
      
      const results = []
      
      // 1. Pay dev fee first
      console.log(`\n   💰 Dev: ${devWallet.slice(0, 8)}... gets ${devFeeSol} SOL (5%)`)
      const devResult = await transferSol(devWallet, devFeeSol)
      results.push(devResult)
      if (devResult.success) {
        console.log(`   ✅ TX: ${devResult.txHash?.slice(0, 20)}...`)
      } else {
        console.log(`   ❌ Failed: ${devResult.error}`)
      }

      // 2. Pay winners from remaining 95%
      for (let i = 0; i < winners.length; i++) {
        const winner = winners[i]
        const payout = remainingPool * winner.pct
        const totalPct = (winner.pct * 0.95 * 100).toFixed(1) // % of total pool
        
        console.log(`   #${i + 1}: ${winner.address.slice(0, 8)}... gets ${payout.toFixed(4)} SOL (${totalPct}%)`)
        
        const result = await transferSol(winner.address, payout)
        results.push(result)
        
        if (result.success) {
          console.log(`   ✅ TX: ${result.txHash?.slice(0, 20)}...`)
        } else {
          console.log(`   ❌ Failed: ${result.error}`)
        }
      }

      // All transfers should succeed
      const allSuccess = results.every(r => r.success)
      expect(allSuccess).toBe(true)
      
      console.log(`\n✅ All ${results.length} payouts completed (1 dev + 3 winners)!`)
    }, 90000) // 90 second timeout for 4 transactions
  })
})

