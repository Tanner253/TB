import { heliusEnhancedVwapEnabled, holderIndexingUsesBirdeye, shouldRunHeliusHolderIndexing } from '@/lib/platform/holderDataSource'

describe('holderDataSource', () => {
  const originalBirdeye = process.env.BIRDEYE_API_KEY
  const originalWorker = process.env.WORKER_OWNS_INDEXING

  afterEach(() => {
    if (originalBirdeye === undefined) delete process.env.BIRDEYE_API_KEY
    else process.env.BIRDEYE_API_KEY = originalBirdeye
    if (originalWorker === undefined) delete process.env.WORKER_OWNS_INDEXING
    else process.env.WORKER_OWNS_INDEXING = originalWorker
    jest.clearAllMocks()
  })

  it('disables Helius Enhanced when Birdeye key is set', () => {
    process.env.BIRDEYE_API_KEY = 'test-key'
    expect(holderIndexingUsesBirdeye()).toBe(true)
    expect(heliusEnhancedVwapEnabled()).toBe(false)
    expect(shouldRunHeliusHolderIndexing(false)).toBe(false)
  })

  it('allows Helius indexing on polls only without Birdeye and without worker mode', () => {
    delete process.env.BIRDEYE_API_KEY
    delete process.env.WORKER_OWNS_INDEXING
    expect(heliusEnhancedVwapEnabled()).toBe(true)
    expect(shouldRunHeliusHolderIndexing(false)).toBe(true)
  })

  it('blocks Helius indexing on polls when worker owns indexing', () => {
    delete process.env.BIRDEYE_API_KEY
    process.env.WORKER_OWNS_INDEXING = 'true'
    expect(shouldRunHeliusHolderIndexing(false)).toBe(false)
  })
})

describe('getWalletTransactions with Birdeye configured', () => {
  const originalBirdeye = process.env.BIRDEYE_API_KEY

  beforeEach(() => {
    process.env.BIRDEYE_API_KEY = 'test-key'
  })

  afterEach(() => {
    if (originalBirdeye === undefined) delete process.env.BIRDEYE_API_KEY
    else process.env.BIRDEYE_API_KEY = originalBirdeye
  })

  it('does not call Helius Enhanced when Birdeye owns VWAP', async () => {
    const helius = await import('@/lib/solana/helius')
    const spy = jest.spyOn(helius, 'fetchEnhancedTransactionsForWallet')
    const txs = await helius.getWalletTransactions(
      'Wallet1111111111111111111111111111111111111',
      'Mint11111111111111111111111111111111'
    )
    expect(txs).toEqual([])
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
