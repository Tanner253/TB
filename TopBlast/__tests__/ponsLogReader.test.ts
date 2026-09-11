jest.mock('@/lib/pons/contracts', () => ({ publicClient: jest.fn() }))
import { publicClient } from '@/lib/pons/contracts'
import { scanLogs } from '@/lib/evm/logReader'
const address = '0x1111111111111111111111111111111111111111'
beforeEach(() => jest.clearAllMocks())
test('shrinks the actual requested range and never skips blocks on a log cap', async () => {
  const getLogs = jest.fn(async ({ fromBlock, toBlock }) => {
    if (toBlock - fromBlock > 3n) throw new Error('query exceeds limit')
    return []
  })
  ;(publicClient as jest.Mock).mockReturnValue({ getLogs })
  const result = await scanLogs({ address, events: [], fromBlock: 0n, toBlock: 7n, startWindow: 8n, onLogs: () => {} })
  expect(getLogs.mock.calls.map(([p]) => [p.fromBlock, p.toBlock])).toEqual([[0n,7n],[0n,3n],[4n,7n]])
  expect(result.lastBlock).toBe(7n)
})
test('honors the exact block budget', async () => {
  const getLogs = jest.fn().mockResolvedValue([])
  ;(publicClient as jest.Mock).mockReturnValue({ getLogs })
  const result = await scanLogs({ address, events: [], fromBlock: 10n, toBlock: 1000n, maxBlocks: 5n, onLogs: () => {} })
  expect(getLogs).toHaveBeenCalledWith(expect.objectContaining({ fromBlock: 10n, toBlock: 14n }))
  expect(result).toMatchObject({ lastBlock: 14n, truncated: true })
})
test('consumer failure stops the scan without retrying partially applied logs', async () => {
  const getLogs = jest.fn().mockResolvedValue([{}])
  ;(publicClient as jest.Mock).mockReturnValue({ getLogs })
  await expect(scanLogs({ address, events: [], fromBlock: 0n, toBlock: 9n, onLogs: () => { throw new Error('DB failed') } })).rejects.toThrow('DB failed')
  expect(getLogs).toHaveBeenCalledTimes(1)
})
test('exhausted RPC retries reject instead of advancing the cursor', async () => {
  jest.useFakeTimers()
  const getLogs = jest.fn().mockRejectedValue(new Error('RPC unavailable'))
  ;(publicClient as jest.Mock).mockReturnValue({ getLogs })
  const assertion = expect(scanLogs({ address, events: [], fromBlock: 0n, toBlock: 9n, onLogs: () => {} })).rejects.toThrow('RPC unavailable')
  await jest.runAllTimersAsync()
  await assertion
  expect(getLogs).toHaveBeenCalledTimes(5)
  jest.useRealTimers()
})
