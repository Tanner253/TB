/**
 * Shared Solana RPC URL — prefers HELIUS_RPC_URL, then Helius API key URL.
 */

function appendApiKeyIfNeeded(baseUrl: string, apiKey: string): string {
  if (!apiKey) return baseUrl
  if (/api-key=|api_key=/i.test(baseUrl)) return baseUrl
  const sep = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${sep}api-key=${apiKey}`
}

function normalizeRpcUrl(raw: string): string {
  let url = raw.trim()
  if (url.startsWith('wss://')) {
    url = `https://${url.slice('wss://'.length)}`
  }
  return url
}

export function getHeliusRpcUrl(): string {
  const apiKey = process.env.HELIUS_API_KEY?.trim() || ''
  const custom = process.env.HELIUS_RPC_URL?.trim()

  if (custom) {
    return appendApiKeyIfNeeded(normalizeRpcUrl(custom), apiKey)
  }

  if (!apiKey) {
    throw new Error('HELIUS_API_KEY is required')
  }

  const network = process.env.SOLANA_NETWORK || 'mainnet'
  if (network === 'devnet') {
    return `https://devnet.helius-rpc.com/?api-key=${apiKey}`
  }
  return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`
}

/** Ordered RPC endpoints — tries primary first, then fallbacks. */
export function getSolanaRpcUrlCandidates(): string[] {
  const network = process.env.SOLANA_NETWORK || 'mainnet'
  const apiKey = process.env.HELIUS_API_KEY?.trim() || ''
  const urls: string[] = []

  try {
    urls.push(getHeliusRpcUrl())
  } catch {
    /* no helius config */
  }

  if (apiKey) {
    const heliusStandard =
      network === 'devnet'
        ? `https://devnet.helius-rpc.com/?api-key=${apiKey}`
        : `https://mainnet.helius-rpc.com/?api-key=${apiKey}`
    if (!urls.includes(heliusStandard)) {
      urls.push(heliusStandard)
    }
  }

  const publicRpc =
    network === 'devnet'
      ? 'https://api.devnet.solana.com'
      : 'https://api.mainnet-beta.solana.com'
  if (!urls.includes(publicRpc)) {
    urls.push(publicRpc)
  }

  return urls
}

export function getSolanaRpcUrl(): string {
  const candidates = getSolanaRpcUrlCandidates()
  return candidates[0] ?? 'https://api.mainnet-beta.solana.com'
}
