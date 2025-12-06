import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import bs58 from 'bs58'
import { config } from '@/lib/config'

// Transfer tokens to a winner
// Returns transaction result
export async function transferTokens(
  recipient: string,
  amount: number
): Promise<{ success: boolean; txHash: string | null; error: string | null }> {
  if (!process.env.PAYOUT_WALLET_PRIVATE_KEY) {
    return {
      success: false,
      txHash: null,
      error: 'PAYOUT_WALLET_PRIVATE_KEY not configured',
    }
  }

  if (!process.env.HELIUS_API_KEY) {
    return {
      success: false,
      txHash: null,
      error: 'HELIUS_API_KEY not configured',
    }
  }

  if (amount <= 0) {
    return {
      success: false,
      txHash: null,
      error: 'Amount must be greater than 0',
    }
  }

  try {
    // Connect to Helius RPC
    const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    const connection = new Connection(rpcUrl, 'confirmed')

    // Load payout wallet
    const payoutKeypair = Keypair.fromSecretKey(bs58.decode(process.env.PAYOUT_WALLET_PRIVATE_KEY))

    // Get token mint
    const mintPubkey = new PublicKey(config.tokenMint)
    const recipientPubkey = new PublicKey(recipient)

    // Get associated token accounts
    const senderATA = await getAssociatedTokenAddress(mintPubkey, payoutKeypair.publicKey)
    const recipientATA = await getAssociatedTokenAddress(mintPubkey, recipientPubkey)

    // Create transfer instruction
    const transferIx = createTransferInstruction(
      senderATA,
      recipientATA,
      payoutKeypair.publicKey,
      BigInt(Math.floor(amount)),
      [],
      TOKEN_PROGRAM_ID
    )

    // Build transaction
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
    const transaction = new Transaction({
      feePayer: payoutKeypair.publicKey,
      blockhash,
      lastValidBlockHeight,
    }).add(transferIx)

    // Sign and send
    transaction.sign(payoutKeypair)
    const txHash = await connection.sendRawTransaction(transaction.serialize())

    // Confirm
    await connection.confirmTransaction({
      signature: txHash,
      blockhash,
      lastValidBlockHeight,
    })

    console.log(`[Transfer] Success: ${txHash}`)
    return { success: true, txHash, error: null }
  } catch (error: any) {
    console.error('[Transfer] Failed:', error)
    return {
      success: false,
      txHash: null,
      error: error.message || 'Transfer failed',
    }
  }
}

// Check payout wallet balance
export async function getPayoutWalletBalance(): Promise<{ sol: number; tokens: number } | null> {
  if (!process.env.PAYOUT_WALLET_PRIVATE_KEY || !process.env.HELIUS_API_KEY) {
    return null
  }

  try {
    const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    const connection = new Connection(rpcUrl, 'confirmed')

    const payoutKeypair = Keypair.fromSecretKey(bs58.decode(process.env.PAYOUT_WALLET_PRIVATE_KEY))
    const mintPubkey = new PublicKey(config.tokenMint)

    // Get SOL balance
    const solBalance = await connection.getBalance(payoutKeypair.publicKey)

    // Get token balance
    const tokenATA = await getAssociatedTokenAddress(mintPubkey, payoutKeypair.publicKey)
    const tokenBalance = await connection.getTokenAccountBalance(tokenATA).catch(() => ({ value: { amount: '0' } }))

    return {
      sol: solBalance / 1e9,
      tokens: parseInt(tokenBalance.value.amount) / Math.pow(10, config.tokenDecimals),
    }
  } catch (error) {
    console.error('[Transfer] Failed to get wallet balance:', error)
    return null
  }
}
