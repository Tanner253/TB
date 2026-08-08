jest.mock('@/lib/tenant/context', () => ({
  getTenantSlug: jest.fn(),
}))

import { getTenantSlug } from '@/lib/tenant/context'
import {
  getCachedTokenHolders,
  setCachedTokenHolders,
  getCachedWalletTransactions,
  setCachedWalletTransactions,
  shouldThrottleFullReindex,
  markFullReindex,
} from '@/lib/solana/heliusCache'

const MINT = 'So11111111111111111111111111111111111111112'
const WALLET = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuQosgAsU'

describe('heliusCache tenant isolation', () => {
  beforeEach(() => {
    global._heliusHolderCache = undefined
    global._heliusTxCache = undefined
    global._heliusIndexThrottle = undefined
    jest.clearAllMocks()
  })

  it('keeps holder lists separate per tenant', () => {
    ;(getTenantSlug as jest.Mock).mockReturnValue('tbla')
    setCachedTokenHolders(MINT, [{ wallet: WALLET, balance: 1 }])

    ;(getTenantSlug as jest.Mock).mockReturnValue('wagmi')
    expect(getCachedTokenHolders(MINT)).toBeNull()

    setCachedTokenHolders(MINT, [{ wallet: WALLET, balance: 99 }])
    expect(getCachedTokenHolders(MINT)).toEqual([{ wallet: WALLET, balance: 99 }])

    ;(getTenantSlug as jest.Mock).mockReturnValue('tbla')
    expect(getCachedTokenHolders(MINT)).toEqual([{ wallet: WALLET, balance: 1 }])
  })

  it('keeps wallet tx history separate per tenant', () => {
    ;(getTenantSlug as jest.Mock).mockReturnValue('tbla')
    setCachedWalletTransactions(WALLET, MINT, [{ signature: 'a', type: 'buy', tokenAmount: 1, solAmount: 0.1, timestamp: 1, pricePerToken: 0.01 } as any])

    ;(getTenantSlug as jest.Mock).mockReturnValue('wagmi')
    expect(getCachedWalletTransactions(WALLET, MINT)).toBeNull()
  })

  it('throttles re-index per tenant', () => {
    ;(getTenantSlug as jest.Mock).mockReturnValue('tbla')
    markFullReindex('rankings')
    expect(shouldThrottleFullReindex('rankings')).toBe(true)

    ;(getTenantSlug as jest.Mock).mockReturnValue('wagmi')
    expect(shouldThrottleFullReindex('rankings')).toBe(false)
  })
})
