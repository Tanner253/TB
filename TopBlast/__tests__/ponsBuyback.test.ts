jest.mock('@/lib/pons/contracts', () => ({
  ...jest.requireActual('@/lib/pons/contracts'), publicClient: jest.fn(), walletClientForKey: jest.fn(),
}))
jest.mock('@/lib/pons/launch', () => ({ getPonsLaunch: jest.fn() }))
jest.mock('@/lib/pons/transfers', () => ({ signingAllowed: jest.fn() }))
jest.mock('@/lib/pons/submissions', () => ({ submitOnce: jest.fn((_a, _b, send) => send()) }))
import { encodeAbiParameters, encodeEventTopics } from 'viem'
import { CURVE_ABI, publicClient, walletClientForKey } from '@/lib/pons/contracts'
import { getPonsLaunch } from '@/lib/pons/launch'
import { signingAllowed } from '@/lib/pons/transfers'
import { quoteCurveBuy, buybackSessionToken } from '@/lib/pons/buyback'
import { accountForKey } from '@/lib/pons/keys'
const key = '0x' + '01'.repeat(32)
const recipient = accountForKey(key)!.address
const token = '0x1111111111111111111111111111111111111111'
const curve = '0x2222222222222222222222222222222222222222'
let client: any, wallet: any
beforeEach(() => {
  jest.clearAllMocks()
  client = { readContract: jest.fn(async ({ functionName }) => ({ getReserves: [1000n,10000n], feeBps: 100n, creatorTaxBps: 100n, sellableTokens: 500n }[functionName as string])),
    simulateContract: jest.fn().mockResolvedValue({ request: {} }), waitForTransactionReceipt: jest.fn() }
  wallet = { writeContract: jest.fn().mockResolvedValue('0xabc') }
  ;(publicClient as jest.Mock).mockReturnValue(client)
  ;(walletClientForKey as jest.Mock).mockReturnValue(wallet)
  ;(signingAllowed as jest.Mock).mockReturnValue(true)
  ;(getPonsLaunch as jest.Mock).mockResolvedValue({ token, curve, nativeQuote: true, phase: 0 })
})
test('rejects invalid private key scalars without throwing', () => {
  expect(accountForKey('0x' + '00'.repeat(32))).toBeNull()
  expect(accountForKey('0x' + 'ff'.repeat(32))).toBeNull()
  expect(accountForKey('not-a-key')).toBeNull()
})
test('caps estimated output at sellable allocation but retains contract price bound', async () => {
  const quote = await quoteCurveBuy(curve, 100n, recipient, 100)
  expect(quote).toEqual({ netQuoteIn: 98n, feeAmount: 1n, taxAmount: 1n, tokensOut: 500n, minTokensOut: 883n })
})
test('omitting execute cannot sign', async () => {
  const result = await buybackSessionToken({ tokenAddress: token, quoteInWei: 100n, tokenDecimals: 0, privateKeyHex: key })
  expect(result.success).toBe(false)
  expect(wallet.writeContract).not.toHaveBeenCalled()
})
test('uses actual partial fill in receipt, not the submitted amount or quote', async () => {
  client.waitForTransactionReceipt.mockResolvedValue({ status: 'success', logs: [{
    address: curve,
    topics: encodeEventTopics({ abi: CURVE_ABI, eventName: 'CurveBuy', args: { buyer: recipient, recipient } }),
    data: encodeAbiParameters([{type:'uint256'},{type:'uint256'},{type:'uint256'},{type:'uint256'}], [55n,500n,0n,0n]),
  }] })
  const result = await buybackSessionToken({ tokenAddress: token, quoteInWei: 100n, tokenDecimals: 0, privateKeyHex: key, execute: true })
  expect(result.success).toBe(true)
  expect(result.tokensOutRaw).toBe('500')
  expect(result.quoteSpent).toBe(55e-18)
})
test('graduated launch routes to v4, never back to the curve', async () => {
  ;(getPonsLaunch as jest.Mock).mockResolvedValue({
    token, curve, nativeQuote: true, phase: 2, poolFee: 0, tickSpacing: 200,
  })
  // Simulation is the gate before signing; make it fail so nothing is sent.
  client.call = jest.fn().mockRejectedValue(new Error('no pool'))
  const result = await buybackSessionToken({ tokenAddress: token, quoteInWei: 100n, tokenDecimals: 0, privateKeyHex: key, execute: true })
  expect(result.venue).toBe('uniswap-v4')
  expect(result.success).toBe(false)
  expect(wallet.writeContract).not.toHaveBeenCalled()
})

test('a launch record missing pool geometry errors instead of throwing', async () => {
  ;(getPonsLaunch as jest.Mock).mockResolvedValue({ token, curve, nativeQuote: true, phase: 2 })
  const result = await buybackSessionToken({ tokenAddress: token, quoteInWei: 100n, tokenDecimals: 0, privateKeyHex: key, execute: true })
  expect(result.success).toBe(false)
  expect(result.error).toMatch(/pool geometry/)
  expect(wallet.writeContract).not.toHaveBeenCalled()
})
test('confirmation timeout retains submitted hash for reconciliation', async () => {
  client.waitForTransactionReceipt.mockRejectedValue(new Error('timeout'))
  const result = await buybackSessionToken({ tokenAddress: token, quoteInWei: 100n, tokenDecimals: 0, privateKeyHex: key, execute: true })
  expect(result).toMatchObject({ success: false, txHash: '0xabc' })
})
