/**
 * Shared Solana RPC URL — prefers HELIUS_RPC_URL, then Helius API key URL.
 */
export function getHeliusRpcUrl(): string {
  const custom = process.env.HELIUS_RPC_URL?.trim()
  if (custom) return custom

  const apiKey = process.env.HELIUS_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('HELIUS_API_KEY is required')
  }

  const network = process.env.SOLANA_NETWORK || 'mainnet'
  if (network === 'devnet') {
    return `https://devnet.helius-rpc.com/?api-key=${apiKey}`
  }
  return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`
}

export function getSolanaRpcUrl(): string {
  try {
    if (process.env.HELIUS_API_KEY?.trim() || process.env.HELIUS_RPC_URL?.trim()) {
      return getHeliusRpcUrl()
    }
  } catch {
    // fall through to public RPC
  }

  const network = process.env.SOLANA_NETWORK || 'mainnet'
  return network === 'devnet'
    ? 'https://api.devnet.solana.com'
    : 'https://api.mainnet-beta.solana.com'
}
