jest.mock('@/lib/db', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('@/lib/pons/contracts', () => ({ ...jest.requireActual('@/lib/pons/contracts'), publicClient: jest.fn() }))
jest.mock('@/lib/pons/launch', () => ({ getPonsLaunch: jest.fn() }))
jest.mock('@/lib/evm/logReader', () => ({ scanLogs: jest.fn() }))
import mongoose from 'mongoose'
import { publicClient } from '@/lib/pons/contracts'
import { getPonsLaunch } from '@/lib/pons/launch'
import { scanLogs } from '@/lib/evm/logReader'
import { indexLaunchHolders } from '@/lib/pons/holderIndex'
import { startMemoryMongo, stopMemoryMongo, clearMemoryCollections } from './helpers/memoryMongo'
const token = '0x1111111111111111111111111111111111111111'
const curve = '0x2222222222222222222222222222222222222222'
const buyer = '0x3333333333333333333333333333333333333333'
const other = '0x4444444444444444444444444444444444444444'
let mongo: Awaited<ReturnType<typeof startMemoryMongo>>, client: any
beforeAll(async () => { mongo = await startMemoryMongo() })
afterAll(async () => { await stopMemoryMongo(mongo) })
beforeEach(async () => {
  await clearMemoryCollections(); await mongoose.connection.db!.collection('pons_holder_checkpoints').deleteMany({}); jest.clearAllMocks()
  client = {
    getBlockNumber: jest.fn().mockResolvedValue(120n),
    getLogs: jest.fn().mockResolvedValue([{ blockNumber: 10n }]),
    getBytecode: jest.fn(async ({ blockNumber }) => blockNumber >= 10n ? '0x01' : undefined),
    getBlock: jest.fn(async ({ blockNumber }) => ({ hash: 'hash' + blockNumber, timestamp: 1000n })),
    readContract: jest.fn().mockResolvedValue(0),
  }
  ;(publicClient as jest.Mock).mockReturnValue(client)
  ;(getPonsLaunch as jest.Mock).mockResolvedValue({ token, curve, nativeQuote: true })
  ;(scanLogs as jest.Mock).mockImplementation(async o => {
    await o.onLogs([
      { address: token, blockNumber: 10n, eventName: 'Transfer', args: { from: curve, to: buyer, value: 100n } },
      { address: curve, blockNumber: 10n, eventName: 'CurveBuy', args: { buyer, recipient: buyer, quoteIn: 10n ** 18n, tokensOut: 100n } },
    ])
    return { lastBlock: o.toBlock, truncated: false }
  })
})
test('persists balances and cost basis and retains holders when no new blocks arrive', async () => {
  const first = await indexLaunchHolders({ tokenAddress: token })
  expect(first!.holders[0]).toMatchObject({ wallet: buyer, balance: 100, totalTokensBought: 100, totalQuoteSpent: 1, vwap: 0.01 })
  expect(await mongoose.connection.db!.collection('pons_holder_checkpoints').countDocuments()).toBe(1)
  const second = await indexLaunchHolders({ tokenAddress: token })
  expect(second!.holders).toEqual(first!.holders)
  expect(scanLogs).toHaveBeenCalledTimes(1)
})
test('failed scan never saves a cursor or partial state', async () => {
  ;(scanLogs as jest.Mock).mockRejectedValue(new Error('RPC failed'))
  await expect(indexLaunchHolders({ tokenAddress: token })).rejects.toThrow('RPC failed')
  expect(await mongoose.connection.db!.collection('pons_holder_checkpoints').countDocuments()).toBe(0)
})
test('CurveSell marks seller, not the address receiving quote', async () => {
  await indexLaunchHolders({ tokenAddress: token })
  client.getBlockNumber.mockResolvedValue(121n)
  ;(scanLogs as jest.Mock).mockImplementation(async o => {
    await o.onLogs([{ address: curve, blockNumber: 21n, eventName: 'CurveSell', args: { seller: buyer, recipient: other, tokensIn: 1n } }])
  })
  const result = await indexLaunchHolders({ tokenAddress: token })
  expect(result!.holders[0].hasSold).toBe(true)
})
test('reorg causes replay from deployment instead of extending a stale checkpoint', async () => {
  await indexLaunchHolders({ tokenAddress: token })
  client.getBlock.mockImplementation(async ({blockNumber}: any) => ({ hash: 'new' + blockNumber, timestamp: 1000n }))
  await indexLaunchHolders({ tokenAddress: token })
  expect((scanLogs as jest.Mock).mock.calls[1][0].fromBlock).toBe(10n)
  const result = await mongoose.connection.db!.collection('pons_holder_checkpoints').findOne({})
  expect(result!.holders[buyer].balance).toBe('100')
})
