import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction, 
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import bs58 from 'bs58'

/**
 * Get the Solana RPC URL based on environment
 * Supports: devnet, mainnet (via Helius or default)
 */
function getRpcUrl(): string {
  const network = process.env.SOLANA_NETWORK || 'mainnet'
  
  if (network === 'devnet') {
    // Use Helius devnet if available, otherwise public devnet
    if (process.env.HELIUS_API_KEY) {
      return `https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    }
    return 'https://api.devnet.solana.com'
  }
  
  // Mainnet - prefer Helius
  if (process.env.HELIUS_API_KEY) {
    return `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
  }
  
  return 'https://api.mainnet-beta.solana.com'
}

/**
 * Wait for transaction confirmation using HTTP polling (no WebSockets)
 * This is required for serverless environments like Vercel
 */
async function confirmTransactionWithPolling(
  connection: Connection,
  signature: string,
  maxRetries: number = 30,
  intervalMs: number = 1000
): Promise<{ confirmed: boolean; error: string | null }> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const status = await connection.getSignatureStatus(signature)
      
      if (status?.value?.confirmationStatus === 'confirmed' || 
          status?.value?.confirmationStatus === 'finalized') {
        return { confirmed: true, error: null }
      }
      
      if (status?.value?.err) {
        return { confirmed: false, error: JSON.stringify(status.value.err) }
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    } catch (err: any) {
      // Network error, keep trying
      console.log(`[Transfer] Polling attempt ${i + 1}/${maxRetries} failed: ${err.message}`)
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }
  }
  
  return { confirmed: false, error: 'Confirmation timeout' }
}

/**
 * Transfer native SOL to a recipient wallet
 * This is used to pay winners in SOL from the treasury
 */
export async function transferSol(
  recipientAddress: string,
  amountSol: number
): Promise<{ success: boolean; txHash: string | null; error: string | null }> {
  
  // Validate private key exists
  if (!process.env.PAYOUT_WALLET_PRIVATE_KEY) {
    return {
      success: false,
      txHash: null,
      error: 'PAYOUT_WALLET_PRIVATE_KEY not configured',
    }
  }

  // Validate amount
  if (amountSol <= 0) {
    return {
      success: false,
      txHash: null,
      error: 'Amount must be greater than 0',
    }
  }

  // Minimum for rent exemption on new accounts (~0.00089 SOL)
  const MIN_RENT_EXEMPTION = 0.001
  if (amountSol < MIN_RENT_EXEMPTION) {
    console.log(`[Transfer] ⚠️ Amount ${amountSol.toFixed(6)} SOL below rent minimum - skipping`)
    return {
      success: false,
      txHash: null,
      error: `Amount ${amountSol.toFixed(6)} SOL below minimum ${MIN_RENT_EXEMPTION} SOL for rent exemption`,
    }
  }

  // Validate recipient address
  let recipientPubkey: PublicKey
  try {
    recipientPubkey = new PublicKey(recipientAddress)
  } catch {
    return {
      success: false,
      txHash: null,
      error: 'Invalid recipient address',
    }
  }

  try {
    const rpcUrl = getRpcUrl()
    const connection = new Connection(rpcUrl, 'confirmed')
    
    // Load payout wallet from private key
    const payoutKeypair = Keypair.fromSecretKey(
      bs58.decode(process.env.PAYOUT_WALLET_PRIVATE_KEY)
    )

    console.log(`[Transfer] Network: ${process.env.SOLANA_NETWORK || 'mainnet'}`)
    console.log(`[Transfer] From: ${payoutKeypair.publicKey.toBase58().slice(0, 8)}...`)
    console.log(`[Transfer] To: ${recipientAddress.slice(0, 8)}...`)
    console.log(`[Transfer] Amount: ${amountSol} SOL`)

    // Check sender balance
    const senderBalance = await connection.getBalance(payoutKeypair.publicKey)
    const lamportsToSend = Math.floor(amountSol * LAMPORTS_PER_SOL)
    
    // Need extra for transaction fee (~5000 lamports)
    const estimatedFee = 5000
    if (senderBalance < lamportsToSend + estimatedFee) {
      return {
        success: false,
        txHash: null,
        error: `Insufficient balance. Have: ${senderBalance / LAMPORTS_PER_SOL} SOL, Need: ${amountSol} SOL + fee`,
      }
    }

    // Create transfer instruction
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: payoutKeypair.publicKey,
      toPubkey: recipientPubkey,
      lamports: lamportsToSend,
    })

    // Build transaction
    const transaction = new Transaction().add(transferInstruction)
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash('confirmed')
    transaction.recentBlockhash = blockhash
    transaction.feePayer = payoutKeypair.publicKey
    
    // Sign the transaction
    transaction.sign(payoutKeypair)

    // Send transaction (without WebSocket confirmation)
    console.log(`[Transfer] Sending transaction...`)
    const txHash = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    })
    
    console.log(`[Transfer] Transaction sent: ${txHash}`)
    console.log(`[Transfer] Waiting for confirmation (HTTP polling)...`)
    
    // Confirm using HTTP polling (no WebSockets - works in serverless)
    const confirmation = await confirmTransactionWithPolling(connection, txHash)
    
    if (confirmation.confirmed) {
      console.log(`[Transfer] ✅ Confirmed: ${txHash}`)
      return { 
        success: true, 
        txHash, 
        error: null 
      }
    } else {
      console.log(`[Transfer] ❌ Confirmation failed: ${confirmation.error}`)
      return {
        success: false,
        txHash,
        error: confirmation.error || 'Transaction not confirmed',
      }
    }

  } catch (error: any) {
    console.error('[Transfer] ❌ Failed:', error.message)
    return {
      success: false,
      txHash: null,
      error: error.message || 'Transfer failed',
    }
  }
}

/**
 * Check the payout wallet's SOL balance
 */
export async function getPayoutWalletBalance(): Promise<{ 
  sol: number
  address: string 
} | null> {
  if (!process.env.PAYOUT_WALLET_PRIVATE_KEY) {
    return null
  }

  try {
    const rpcUrl = getRpcUrl()
    const connection = new Connection(rpcUrl, 'confirmed')
    
    const payoutKeypair = Keypair.fromSecretKey(
      bs58.decode(process.env.PAYOUT_WALLET_PRIVATE_KEY)
    )

    const balance = await connection.getBalance(payoutKeypair.publicKey)

    return {
      sol: balance / LAMPORTS_PER_SOL,
      address: payoutKeypair.publicKey.toBase58(),
    }
  } catch (error) {
    console.error('[Transfer] Failed to get wallet balance:', error)
    return null
  }
}

/**
 * Verify connection to Solana network
 */
export async function verifyConnection(): Promise<{
  connected: boolean
  network: string
  blockHeight: number | null
}> {
  try {
    const rpcUrl = getRpcUrl()
    const connection = new Connection(rpcUrl, 'confirmed')
    const blockHeight = await connection.getBlockHeight()
    
    return {
      connected: true,
      network: process.env.SOLANA_NETWORK || 'mainnet',
      blockHeight,
    }
  } catch {
    return {
      connected: false,
      network: process.env.SOLANA_NETWORK || 'mainnet',
      blockHeight: null,
    }
  }
}
