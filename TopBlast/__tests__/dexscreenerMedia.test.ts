import {
  mediaFromDexScreenerPair,
  selectBestSolanaPairForMedia,
} from '@/lib/solana/dexscreenerMedia'

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

  it('falls back to openGraph when imageUrl is missing', () => {
    const media = mediaFromDexScreenerPair({
      chainId: 'solana',
      dexId: 'pumpfun',
      pairAddress: 'abc',
      baseToken: { address: 'mint' },
      quoteToken: { address: 'sol' },
      info: {
        openGraph: 'https://cdn.dexscreener.com/og.png',
      },
    })

    expect(media.iconUrl).toBe('https://cdn.dexscreener.com/og.png')
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

  it('prefers a pair that has image metadata over a higher-liq bare pair', () => {
    const best = selectBestSolanaPairForMedia(
      [
        {
          chainId: 'solana',
          dexId: 'raydium',
          pairAddress: 'no-art',
          priceUsd: '1',
          liquidity: { usd: 100_000 },
          baseToken: { address: 'mint' },
          quoteToken: { address: 'sol' },
        },
        {
          chainId: 'solana',
          dexId: 'pumpswap',
          pairAddress: 'has-art',
          priceUsd: '1',
          liquidity: { usd: 1_000 },
          baseToken: { address: 'mint' },
          quoteToken: { address: 'sol' },
          info: { imageUrl: 'https://cdn.dexscreener.com/icon.png' },
        },
      ],
      'mint'
    )

    expect(best?.pairAddress).toBe('has-art')
  })

  it('falls back to Pump.fun image_uri when DexScreener has no icon', async () => {
    const mint = 'EvEPfQmH2BEe9XbiV8fghaafRWbG7n5oBEiLy5KNpump'
    const pumpIcon =
      'https://axiomtrading.sfo3.cdn.digitaloceanspaces.com/DG4ZMjV8zw5id6N1s5Cc7ASrxhrMYJSYdh4jLNkExBa3.webp'

    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('dexscreener.com')) {
        return {
          ok: true,
          json: async () => ({
            pairs: [
              {
                chainId: 'solana',
                dexId: 'pumpfun',
                pairAddress: 'pair',
                baseToken: { address: mint },
                quoteToken: { address: 'So11111111111111111111111111111111111111112' },
                url: `https://dexscreener.com/solana/pair`,
              },
            ],
          }),
        } as Response
      }
      if (url.includes('pump.fun/coins/')) {
        return {
          ok: true,
          json: async () => ({ image_uri: pumpIcon, name: 'Up Only', symbol: 'UP' }),
        } as Response
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const prevFetch = global.fetch
    global.fetch = fetchMock as typeof fetch
    try {
      // Clear module cache so in-process media cache starts empty for this mint
      jest.resetModules()
      const { fetchDexScreenerTokenMedia } = await import('@/lib/solana/dexscreenerMedia')
      const media = await fetchDexScreenerTokenMedia(mint)
      expect(media?.iconUrl).toBe(pumpIcon)
      expect(fetchMock).toHaveBeenCalled()
    } finally {
      global.fetch = prevFetch
    }
  })
})
