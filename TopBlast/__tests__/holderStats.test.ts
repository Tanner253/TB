import { getOnChainHolderStats } from '@/lib/solana/holderStats'
import { meetsMinTokenHoldingFromChain } from '@/lib/solana/tokenAmount'

jest.mock('@/lib/solana/indexer', () => ({
  getTokenHolders: jest.fn(),
}))

jest.mock('@/lib/eligibility/liquidityPools', () => ({
  ensureLiquidityPoolAddresses: jest.fn().mockResolvedValue(new Set()),
  isLiquidityPoolWallet: jest.fn((wallet: string) => wallet === 'LP_WALLET'),
}))

jest.mock('@/lib/eligibility/excludedWallets', () => ({
  isExcludedParticipantWallet: jest.fn((wallet: string) => wallet === 'DEV_WALLET'),
}))

jest.mock('@/lib/config', () => ({
  config: {
    tokenDecimals: 6,
    minTokenHolding: 1000,
    maxHoldersToProcess: 1000,
  },
}))

import { getTokenHolders } from '@/lib/solana/indexer'

describe('holderStats', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('counts raw, trackable, and qualifying holders separately', async () => {
    ;(getTokenHolders as jest.Mock).mockResolvedValue([
      { wallet: 'LP_WALLET', balance: 9_000_000_000_000, isContract: true },
      { wallet: 'DEV_WALLET', balance: 5_000_000_000, isContract: false },
      { wallet: 'A', balance: 2_000_000_000, isContract: false },
      { wallet: 'B', balance: 1_500_000_000, isContract: false },
      { wallet: 'C', balance: 500_000, isContract: false },
    ])

    const stats = await getOnChainHolderStats('MINT111')

    expect(stats.raw).toBe(5)
    expect(stats.trackable).toBe(3)
    expect(stats.qualifying).toBe(2)
    expect(
      meetsMinTokenHoldingFromChain(500_000, 6, 1000)
    ).toBe(false)
  })
})
