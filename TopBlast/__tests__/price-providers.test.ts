import {
  inferMigrationStage,
  selectBestSolanaPair,
  selectBestSolUsdPair,
  NATIVE_SOL_MINT,
} from '@/lib/solana/dexscreenerShared'

describe('dexscreener price provider', () => {
  const mint = 'TokenMint111111111111111111111111111111111'

  it('selects highest-liquidity Solana pair for a mint', () => {
    const pairs = [
      {
        chainId: 'solana',
        dexId: 'pumpfun',
        pairAddress: 'bonding',
        priceUsd: '0.00001',
        liquidity: { usd: 5000 },
        baseToken: { address: mint },
        quoteToken: { address: 'So11111111111111111111111111111111111111112' },
      },
      {
        chainId: 'solana',
        dexId: 'pumpswap',
        pairAddress: 'migrated',
        priceUsd: '0.000012',
        liquidity: { usd: 85000 },
        baseToken: { address: mint },
        quoteToken: { address: 'So11111111111111111111111111111111111111112' },
      },
      {
        chainId: 'ethereum',
        dexId: 'uniswap',
        pairAddress: 'eth',
        priceUsd: '0.00002',
        liquidity: { usd: 999999 },
        baseToken: { address: mint },
        quoteToken: { address: '0x0' },
      },
    ]

    const best = selectBestSolanaPair(pairs as any, mint)
    expect(best?.dexId).toBe('pumpswap')
    expect(best?.pairAddress).toBe('migrated')
  })

  it('infers pump.fun migration stages', () => {
    expect(inferMigrationStage('pumpfun')).toBe('bonding_curve')
    expect(inferMigrationStage('pumpswap')).toBe('migrated')
    expect(inferMigrationStage('raydium')).toBe('standard')
    expect(inferMigrationStage('orca')).toBe('standard')
  })

  it('selects SOL-base pairs for SOL/USD (not meme/SOL pairs)', () => {
    const pairs = [
      {
        chainId: 'solana',
        dexId: 'raydium',
        pairAddress: 'sol-usdc',
        priceUsd: '142.5',
        liquidity: { usd: 5_000_000 },
        baseToken: { address: NATIVE_SOL_MINT },
        quoteToken: { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
      },
      {
        chainId: 'solana',
        dexId: 'pumpswap',
        pairAddress: 'meme-sol',
        priceUsd: '0.00001',
        liquidity: { usd: 999_999_999 },
        baseToken: { address: mint },
        quoteToken: { address: NATIVE_SOL_MINT },
      },
    ]

    const best = selectBestSolUsdPair(pairs as any, NATIVE_SOL_MINT)
    expect(best?.pairAddress).toBe('sol-usdc')
    expect(best?.priceUsd).toBe('142.5')
  })
})
