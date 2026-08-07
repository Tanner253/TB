import {
  inferMigrationStage,
  selectBestSolanaPair,
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
})
