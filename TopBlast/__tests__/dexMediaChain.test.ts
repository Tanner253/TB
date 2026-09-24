import { mediaFromDexScreenerTokenResponse } from '@/lib/solana/dexscreenerMedia'

/** Shape of DexScreener's real response for $TOPBLAST on Robinhood Chain. */
const TOPBLAST = '0xcdf5893b26f39312318a3c599c54ae2df4f23b1a'
const robinhoodPair = {
  chainId: 'robinhood',
  dexId: 'uniswap',
  url: 'https://dexscreener.com/robinhood/0xpair',
  baseToken: { address: TOPBLAST },
  liquidity: { usd: 10_000 },
  info: {
    imageUrl: 'https://cdn.dexscreener.com/cms/images/icon',
    header: 'https://cdn.dexscreener.com/cms/images/banner',
  },
}

describe('token media on Robinhood Chain', () => {
  it('uses art from robinhood pairs instead of discarding them', () => {
    const media = mediaFromDexScreenerTokenResponse({ pairs: [robinhoodPair] as never }, TOPBLAST)
    expect(media?.iconUrl).toBe('https://cdn.dexscreener.com/cms/images/icon')
    expect(media?.bannerUrl).toBe('https://cdn.dexscreener.com/cms/images/banner')
  })

  it('ignores art from a different chain for an EVM token', () => {
    const media = mediaFromDexScreenerTokenResponse(
      { pairs: [{ ...robinhoodPair, chainId: 'solana' }] as never },
      TOPBLAST
    )
    expect(media).toBeNull()
  })

  it('returns nothing when the pair has no art, like BLASTY today', () => {
    const media = mediaFromDexScreenerTokenResponse(
      { pairs: [{ ...robinhoodPair, info: {} }] as never },
      TOPBLAST
    )
    expect(media).toBeNull()
  })
})
