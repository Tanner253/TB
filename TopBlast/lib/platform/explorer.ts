/**
 * Block explorer links, chosen by the chain the address belongs to.
 *
 * Deliberately dependency-free (no `server-only`, no config) so client
 * components resolve the same link the server does — the shape of the address
 * is the whole input, exactly as in `chainShape.ts`.
 *
 * Robinhood Chain runs Blockscout. `explorer.mainnet.chain.robinhood.com`
 * redirects there but DROPS the path, so a link built on that host lands on
 * the explorer's home page instead of the token — always use the canonical
 * Blockscout host.
 */

import { isEvmAddressShape, isLegacyChainMint } from './chainShape'

const BLOCKSCOUT = 'https://robinhoodchain.blockscout.com'
const BLOCKSCOUT_TESTNET = 'https://robinhoodchain-testnet.blockscout.com'
const SOLSCAN = 'https://solscan.io'

function evmBase(testnet = false): string {
  return testnet ? BLOCKSCOUT_TESTNET : BLOCKSCOUT
}

/** True when this address should be looked up on Robinhood Chain. */
export function usesEvmExplorer(value: string | null | undefined): boolean {
  return isEvmAddressShape(value)
}

/** Token/contract page. */
export function tokenExplorerUrl(
  mint: string | null | undefined,
  opts?: { testnet?: boolean }
): string | null {
  const v = mint?.trim()
  if (!v) return null
  if (isLegacyChainMint(v)) return `${SOLSCAN}/token/${v}`
  return `${evmBase(opts?.testnet)}/token/${v}`
}

/** Wallet/account page. A wallet is EVM whenever it is 0x-shaped. */
export function addressExplorerUrl(
  address: string | null | undefined,
  opts?: { testnet?: boolean }
): string | null {
  const v = address?.trim()
  if (!v) return null
  if (isEvmAddressShape(v)) return `${evmBase(opts?.testnet)}/address/${v}`
  return `${SOLSCAN}/account/${v}`
}

/**
 * Transaction page. A tx hash carries no chain hint of its own — Solana
 * signatures are base58 and EVM hashes are 0x + 64 hex — so the shape decides,
 * and a caller that knows the chain can force it.
 */
export function txExplorerUrl(
  txHash: string | null | undefined,
  opts?: { evm?: boolean; testnet?: boolean }
): string | null {
  const v = txHash?.trim()
  if (!v) return null
  const evm = opts?.evm ?? /^0x[0-9a-fA-F]{64}$/.test(v)
  return evm ? `${evmBase(opts?.testnet)}/tx/${v}` : `${SOLSCAN}/tx/${v}`
}

/** What to call the explorer in link text and tooltips. */
export function explorerLabel(value: string | null | undefined): string {
  return usesEvmExplorer(value) ? 'Blockscout' : 'Solscan'
}
