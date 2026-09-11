jest.mock('@/lib/db', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('@/lib/config', () => ({ config: { tokenMint: '0x1111111111111111111111111111111111111111' } }))
jest.mock('@/lib/payout/executor', () => ({ getCurrentPayoutCycle: () => 2 }))
import mongoose from 'mongoose'
import { submitOnce } from '@/lib/pons/submissions'
import { startMemoryMongo, stopMemoryMongo, clearMemoryCollections } from './helpers/memoryMongo'
let mongo: Awaited<ReturnType<typeof startMemoryMongo>>
beforeAll(async () => { mongo = await startMemoryMongo() })
afterAll(async () => { await stopMemoryMongo(mongo) })
beforeEach(async () => { await clearMemoryCollections(); await mongoose.connection.db!.collection('pons_payout_submissions').deleteMany({}) })
test('retry returns the same transaction without sending twice', async () => {
 const send = jest.fn().mockResolvedValue('0xabc')
 expect(await submitOnce('winner:1', '100', send)).toBe('0xabc')
 expect(await submitOnce('winner:1', '100', send)).toBe('0xabc')
 expect(send).toHaveBeenCalledTimes(1)
})
test('unknown submission status prevents automatic retry', async () => {
 const send = jest.fn().mockRejectedValue(new Error('connection lost'))
 await expect(submitOnce('winner:1', '100', send)).rejects.toThrow()
 await expect(submitOnce('winner:1', '100', send)).rejects.toThrow('unknown status')
 expect(send).toHaveBeenCalledTimes(1)
})
test('changed amount cannot reuse or duplicate a submitted payment', async () => {
 const send = jest.fn().mockResolvedValue('0xabc')
 await submitOnce('winner:1', '100', send)
 await expect(submitOnce('winner:1', '200', send)).rejects.toThrow('terms changed')
 expect(send).toHaveBeenCalledTimes(1)
})
