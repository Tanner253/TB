/**
 * Proves mint is accepted but not forwarded to Helius Enhanced API params.
 * No network — inspects fetchEnhancedTransactionsForWallet implementation contract.
 */
import axios from 'axios'
import { fetchEnhancedTransactionsForWallet } from '@/lib/solana/helius'

jest.mock('axios')
jest.mock('@/lib/solana/rpcUrl', () => ({
  getHeliusRpcUrl: () => 'https://mainnet.helius-rpc.com/?api-key=test',
}))

const mockedAxios = axios as jest.Mocked<typeof axios>

describe('Helius Enhanced wallet fetch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.HELIUS_API_KEY = 'test-key'
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: [{ signature: 'sig1', tokenTransfers: [] }],
    })
  })

  it('does NOT pass mint to Helius query params (client filter only)', async () => {
    await fetchEnhancedTransactionsForWallet('Wallet111', {
      maxPages: 1,
      mint: 'Mint2222222222222222222222222222222222222222',
    })

    expect(mockedAxios.get).toHaveBeenCalledTimes(1)
    const callUrl = mockedAxios.get.mock.calls[0][0] as string
    const params = mockedAxios.get.mock.calls[0][1]?.params as Record<string, unknown>

    expect(callUrl).toContain('/v0/addresses/Wallet111/transactions')
    expect(params.mint).toBeUndefined()
    expect(params['mint']).toBeUndefined()
    expect(JSON.stringify(params)).not.toContain('Mint222')
  })

  it('requests token-accounts=balanceChanged but no CA filter', async () => {
    await fetchEnhancedTransactionsForWallet('Wallet111', { maxPages: 1 })

    const params = mockedAxios.get.mock.calls[0][1]?.params as Record<string, unknown>
    expect(params['token-accounts']).toBe('balanceChanged')
    expect(Object.keys(params).sort()).toEqual(['api-key', 'limit', 'token-accounts'].sort())
  })
})
