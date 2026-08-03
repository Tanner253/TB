import { getEvmChainId, ROBINHOOD_TESTNET_CHAIN_ID, BLOCKSCOUT_MAINNET, BLOCKSCOUT_TESTNET } from './chain'

export function getTxExplorerUrl(txHash: string | null | undefined): string | null {
  if (!txHash) return null
  const chainId = getEvmChainId()
  const base = chainId === ROBINHOOD_TESTNET_CHAIN_ID ? BLOCKSCOUT_TESTNET : BLOCKSCOUT_MAINNET
  return `${base}/tx/${txHash}`
}

export function getExplorerLabel(): string {
  return 'Blockscout'
}
