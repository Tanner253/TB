const SOLSCAN_MAINNET = 'https://solscan.io'
const SOLSCAN_DEVNET = 'https://solscan.io/?cluster=devnet'

function getSolscanBase(): string {
  const network = process.env.SOLANA_NETWORK || 'mainnet'
  return network === 'devnet' ? SOLSCAN_DEVNET : SOLSCAN_MAINNET
}

export function getTxExplorerUrl(txHash: string | null | undefined): string | null {
  if (!txHash) return null
  const base = getSolscanBase()
  if (base.includes('cluster=devnet')) {
    return `${SOLSCAN_MAINNET}/tx/${txHash}?cluster=devnet`
  }
  return `${base}/tx/${txHash}`
}

export function getAddressExplorerUrl(address: string | null | undefined): string | null {
  if (!address) return null
  const network = process.env.SOLANA_NETWORK || 'mainnet'
  if (network === 'devnet') {
    return `${SOLSCAN_MAINNET}/account/${address}?cluster=devnet`
  }
  return `${SOLSCAN_MAINNET}/account/${address}`
}

export function getExplorerLabel(): string {
  return 'Solscan'
}
