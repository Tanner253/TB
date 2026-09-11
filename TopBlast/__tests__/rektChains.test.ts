/**
 * The Rekt card accepts wallets on both chains. What matters is that each
 * address form is routed to the right pipeline, and that DexScreener pair
 * selection respects the case rules of the chain it is matching on — EVM
 * addresses are case-insensitive, base58 mints are not.
 */

import { isValidWalletAddress } from '@/lib/rekt/rektReport'
import {
  selectBestPairOnChain,
  type DexScreenerPairLike,
} from '@/lib/solana/dexscreenerShared'

const EVM = '0x9a311b627d66ff233f4a7055ddbb19876334ee20'
const SOL = 'JAKnM5B8pC7747QqGEGyeJmdAn55mmjb2Eqd2bpSpump'

function pair(
  chainId: string,
  base: string,
  priceUsd: string,
  liquidityUsd: number
): DexScreenerPairLike {
  return {
    chainId,
    dexId: 'pons',
    pairAddress: `pair-${base}-${liquidityUsd}`,
    baseToken: { address: base, symbol: 'TKN' },
    quoteToken: { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH' },
    priceUsd,
    liquidity: { usd: liquidityUsd },
  } as DexScreenerPairLike
}

describe('isValidWalletAddress', () => {
  it('accepts EVM addresses in any case', () => {
    expect(isValidWalletAddress(EVM)).toBe(true)
    expect(isValidWalletAddress(EVM.toUpperCase().replace('0X', '0x'))).toBe(true)
    expect(isValidWalletAddress(`  ${EVM}  `)).toBe(true)
  })

  it('still accepts base58 Solana wallets', () => {
    expect(isValidWalletAddress(SOL)).toBe(true)
  })

  it('rejects junk and truncated addresses', () => {
    expect(isValidWalletAddress('0x1234')).toBe(false)
    expect(isValidWalletAddress('not-an-address')).toBe(false)
    expect(isValidWalletAddress('')).toBe(false)
  })
})

describe('selectBestPairOnChain', () => {
  const pairs = [
    pair('solana', SOL, '0.5', 10_000),
    pair('robinhood', EVM, '1.25', 500),
    pair('robinhood', EVM, '1.30', 9_000),
    pair('ethereum', EVM, '99', 1_000_000),
  ]

  it('picks the deepest pool on the requested chain only', () => {
    const best = selectBestPairOnChain(pairs, EVM, 'robinhood')
    expect(best?.priceUsd).toBe('1.30')
  })

  it('does not leak a match from another chain', () => {
    expect(selectBestPairOnChain(pairs, SOL, 'robinhood')).toBeNull()
    expect(selectBestPairOnChain(pairs, EVM, 'solana')).toBeNull()
  })

  it('matches EVM addresses case-insensitively', () => {
    const upper = selectBestPairOnChain(pairs, EVM.toUpperCase().replace('0X', '0x'), 'robinhood')
    expect(upper?.priceUsd).toBe('1.30')
  })

  it('keeps base58 matching exact — case carries meaning there', () => {
    expect(selectBestPairOnChain(pairs, SOL.toLowerCase(), 'solana')).toBeNull()
    expect(selectBestPairOnChain(pairs, SOL, 'solana')?.priceUsd).toBe('0.5')
  })

  it('ignores pairs with no usable price', () => {
    const unpriced = [pair('robinhood', EVM, '0', 50_000)]
    expect(selectBestPairOnChain(unpriced, EVM, 'robinhood')).toBeNull()
  })
})
