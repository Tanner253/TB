import { 
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
 * Generic JSON-RPC helper to avoid WebSockets completely
 */
async function jsonRpcCall(rpcUrl: string, method: string, params: any[]): Promise<any> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'rpc-' + Date.now(),
      method,
      params,
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()
  if (data.error) {
    throw new Error(data.error.message || JSON.stringify(data.error))
  }

  return data.result
}

/**
 * Wait for transaction confirmation using HTTP polling (no WebSockets)
 * This is required for serverless environments like Vercel
 */
async function confirmTransactionWithPolling(
  rpcUrl: string,
  signature: string,
  maxRetries: number = 30,
  intervalMs: number = 1000
): Promise<{ confirmed: boolean; error: string | null }> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Use getSignatureStatuses RPC directly
      const result = await jsonRpcCall(rpcUrl, 'getSignatureStatuses', [[signature], { searchTransactionHistory: true }])
      
      const status = result?.value?.[0]
      
      if (status) {
        if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
          return { confirmed: true, error: null }
        }
        if (status.err) {
          return { confirmed: false, error: JSON.stringify(status.err) }
        }
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
 * Helper to get latest blockhash via HTTP (avoiding WebSockets)
 */
async function getLatestBlockhashHttp(rpcUrl: string): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  try {
    const result = await jsonRpcCall(rpcUrl, 'getLatestBlockhash', [{ commitment: 'confirmed' }])
    return result.value
  } catch (error: any) {
    throw new Error(`Failed to get blockhash: ${error.message}`)
  }
}

/**
 * Helper to send raw transaction via HTTP (avoiding WebSockets)
 */
async function sendRawTransactionHttp(
  serializedTransaction: Buffer | Uint8Array,
  rpcUrl: string,
  options: { skipPreflight?: boolean; preflightCommitment?: string } = {}
): Promise<string> {
  try {
    const base58Tx = bs58.encode(serializedTransaction)
    
    return await jsonRpcCall(rpcUrl, 'sendTransaction', [
      base58Tx,
      {
        encoding: 'base58',
        skipPreflight: options.skipPreflight ?? false,
        preflightCommitment: options.preflightCommitment ?? 'confirmed',
      },
    ])
  } catch (error: any) {
    throw new Error(`Failed to send transaction: ${error.message}`)
  }
}

/**
 * Helper to get balance via HTTP
 */
async function getBalanceHttp(rpcUrl: string, pubkey: PublicKey): Promise<number> {
  const result = await jsonRpcCall(rpcUrl, 'getBalance', [pubkey.toBase58()])
  return result?.value || 0
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
    
    // Load payout wallet from private key
    const payoutKeypair = Keypair.fromSecretKey(
      bs58.decode(process.env.PAYOUT_WALLET_PRIVATE_KEY)
    )

    console.log(`[Transfer] Network: ${process.env.SOLANA_NETWORK || 'mainnet'}`)
    console.log(`[Transfer] From: ${payoutKeypair.publicKey.toBase58().slice(0, 8)}...`)
    console.log(`[Transfer] To: ${recipientAddress.slice(0, 8)}...`)
    console.log(`[Transfer] Amount: ${amountSol} SOL`)

    // Check sender balance (HTTP)
    const senderBalance = await getBalanceHttp(rpcUrl, payoutKeypair.publicKey)
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
    
    // Get recent blockhash - Using HTTP fallback to avoid WebSocket issues
    console.log(`[Transfer] Getting blockhash (HTTP)...`)
    const { blockhash } = await getLatestBlockhashHttp(rpcUrl)
    transaction.recentBlockhash = blockhash
    transaction.feePayer = payoutKeypair.publicKey
    
    // Sign the transaction
    transaction.sign(payoutKeypair)

    // Send transaction (without WebSocket confirmation)
    console.log(`[Transfer] Sending transaction (HTTP)...`)
    
    // Use manual HTTP send to guarantee no WebSockets
    const txHash = await sendRawTransactionHttp(
      transaction.serialize(),
      rpcUrl,
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      }
    )
    
    console.log(`[Transfer] Transaction sent: ${txHash}`)
    console.log(`[Transfer] Waiting for confirmation (HTTP polling)...`)
    
    // Confirm using HTTP polling (no WebSockets - works in serverless)
    const confirmation = await confirmTransactionWithPolling(rpcUrl, txHash)
    
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
    
    const payoutKeypair = Keypair.fromSecretKey(
      bs58.decode(process.env.PAYOUT_WALLET_PRIVATE_KEY)
    )

    // Use HTTP for balance
    const balance = await getBalanceHttp(rpcUrl, payoutKeypair.publicKey)

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
    // Use HTTP for block height
    const result = await jsonRpcCall(rpcUrl, 'getBlockHeight', [])
    const blockHeight = result as number
    
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
