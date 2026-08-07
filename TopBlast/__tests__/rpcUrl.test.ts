import {
  getHeliusRpcUrl,
  getSolanaRpcUrlCandidates,
} from '@/lib/solana/rpcUrl'

describe('rpcUrl', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    delete process.env.HELIUS_RPC_URL
    delete process.env.HELIUS_API_KEY
    delete process.env.SOLANA_NETWORK
  })

  afterAll(() => {
    process.env = env
  })

  it('builds standard Helius URL from API key', () => {
    process.env.HELIUS_API_KEY = 'test-key'
    expect(getHeliusRpcUrl()).toBe('https://mainnet.helius-rpc.com/?api-key=test-key')
  })

  it('appends api-key to custom HELIUS_RPC_URL when missing', () => {
    process.env.HELIUS_RPC_URL = 'https://alaine-vqald4-fast-mainnet.helius-rpc.com'
    process.env.HELIUS_API_KEY = 'test-key'
    expect(getHeliusRpcUrl()).toBe(
      'https://alaine-vqald4-fast-mainnet.helius-rpc.com?api-key=test-key'
    )
  })

  it('converts wss custom URL to https', () => {
    process.env.HELIUS_RPC_URL = 'wss://mainnet.helius-rpc.com/'
    process.env.HELIUS_API_KEY = 'test-key'
    expect(getHeliusRpcUrl()).toBe('https://mainnet.helius-rpc.com/?api-key=test-key')
  })

  it('includes public RPC as final fallback candidate', () => {
    process.env.HELIUS_API_KEY = 'test-key'
    const urls = getSolanaRpcUrlCandidates()
    expect(urls[urls.length - 1]).toBe('https://api.mainnet-beta.solana.com')
  })
})
