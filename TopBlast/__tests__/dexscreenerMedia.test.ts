import { mediaFromDexScreenerPair } from '@/lib/solana/dexscreenerMedia'

describe('dexscreenerMedia', () => {
  it('extracts icon and banner from pair info', () => {
    const media = mediaFromDexScreenerPair({
      chainId: 'solana',
      dexId: 'pumpfun',
      pairAddress: 'abc',
      baseToken: { address: 'mint' },
      quoteToken: { address: 'sol' },
      info: {
        imageUrl: 'https://cdn.dexscreener.com/icon.png',
        header: 'https://cdn.dexscreener.com/banner.png',
      },
    })

    expect(media.iconUrl).toBe('https://cdn.dexscreener.com/icon.png')
    expect(media.bannerUrl).toBe('https://cdn.dexscreener.com/banner.png')
    expect(media.dexProfilePaid).toBe(true)
  })

  it('marks dexProfilePaid when boosts are active', () => {
    const media = mediaFromDexScreenerPair({
      chainId: 'solana',
      dexId: 'raydium',
      pairAddress: 'abc',
      baseToken: { address: 'mint' },
      quoteToken: { address: 'sol' },
      info: { imageUrl: 'https://cdn.dexscreener.com/icon.png' },
      boosts: { active: 2 },
    })

    expect(media.dexProfilePaid).toBe(true)
    expect(media.bannerUrl).toBeNull()
  })

  it('returns null urls when info is missing', () => {
    const media = mediaFromDexScreenerPair({
      chainId: 'solana',
      dexId: 'raydium',
      pairAddress: 'abc',
      baseToken: { address: 'mint' },
      quoteToken: { address: 'sol' },
    })

    expect(media.iconUrl).toBeNull()
    expect(media.bannerUrl).toBeNull()
    expect(media.dexProfilePaid).toBe(false)
  })
})
