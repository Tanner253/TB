/**
 * Robinhood Chain (EVM) configuration
 * Mirrors patterns from waddlebet/server/config/evm.js
 */

export const ROBINHOOD_MAINNET_CHAIN_ID = 4663
export const ROBINHOOD_TESTNET_CHAIN_ID = 46630

export const MAINNET_RPC = 'https://rpc.mainnet.chain.robinhood.com'
export const TESTNET_RPC = 'https://rpc.testnet.chain.robinhood.com'

export const BLOCKSCOUT_MAINNET = 'https://robinhoodchain.blockscout.com'
export const BLOCKSCOUT_TESTNET = 'https://explorer.testnet.chain.robinhood.com'

/** SOLANA_NETWORK env kept for Vercel compatibility: mainnet → 4663, devnet/testnet → 46630 */
export function getEvmChainId(): number {
  const network = process.env.SOLANA_NETWORK || 'mainnet'
  if (network === 'devnet' || network === 'testnet') {
    return ROBINHOOD_TESTNET_CHAIN_ID
  }
  return ROBINHOOD_MAINNET_CHAIN_ID
}

/** HELIUS_RPC_URL env reused as optional custom RPC override */
export function getEvmRpcUrl(): string {
  if (process.env.HELIUS_RPC_URL) {
    return process.env.HELIUS_RPC_URL
  }
  return getEvmChainId() === ROBINHOOD_TESTNET_CHAIN_ID ? TESTNET_RPC : MAINNET_RPC
}

export function getBlockscoutApiBase(): string {
  const chainId = getEvmChainId()
  const base = chainId === ROBINHOOD_TESTNET_CHAIN_ID ? BLOCKSCOUT_TESTNET : BLOCKSCOUT_MAINNET
  return `${base}/api/v2`
}

export function getChainConfig(chainId?: number) {
  const id = chainId ?? getEvmChainId()
  return {
    id,
    name: id === ROBINHOOD_TESTNET_CHAIN_ID ? 'Robinhood Chain Testnet' : 'Robinhood Chain',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  }
}
