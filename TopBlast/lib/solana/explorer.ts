/**
 * Explorer links for server-rendered payloads (payout history, cycle proof).
 *
 * Kept at this path because a lot of callers import it, but the chain is no
 * longer assumed: every function delegates to `lib/platform/explorer`, which
 * picks Solscan or Robinhood Chain's Blockscout from the address shape. A
 * legacy Solana payout keeps its Solscan link; an EVM one gets Blockscout.
 */

import {
  addressExplorerUrl,
  explorerLabel,
  tokenExplorerUrl,
  txExplorerUrl,
} from '@/lib/platform/explorer'

function onTestnet(): boolean {
  return (process.env.CHAIN_NETWORK || 'mainnet').toLowerCase() === 'testnet'
}

export function getTxExplorerUrl(txHash: string | null | undefined): string | null {
  return txExplorerUrl(txHash, { testnet: onTestnet() })
}

export function getAddressExplorerUrl(address: string | null | undefined): string | null {
  return addressExplorerUrl(address, { testnet: onTestnet() })
}

export function getTokenMintExplorerUrl(mint: string | null | undefined): string | null {
  return tokenExplorerUrl(mint, { testnet: onTestnet() })
}

/**
 * Explorer name for link text. Takes the address it is labelling — a session
 * can show a legacy row and an EVM row on the same page, so there is no single
 * answer for the whole deployment.
 */
export function getExplorerLabel(value?: string | null): string {
  return explorerLabel(value)
}
