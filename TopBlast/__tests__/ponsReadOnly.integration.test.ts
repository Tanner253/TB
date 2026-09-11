/** Opt-in, public RPC reads only; database is always an isolated MongoMemoryServer. */
jest.mock('@/lib/db', () => ({ __esModule: true, default: jest.fn() }))
import { writeFileSync } from 'fs'
import { formatUnits } from 'viem'
import { getV1Launch } from '@/lib/pons/v1'
import { indexLaunchHolders } from '@/lib/pons/holderIndex'
import { publicClient, ERC20_ABI } from '@/lib/pons/contracts'
import { startMemoryMongo, stopMemoryMongo } from './helpers/memoryMongo'
const token = process.env.PONS_READONLY_TOKEN
const run = token ? describe : describe.skip
run('Pons public retrieval integration', () => {
 test('indexes the supplied V1 token and independently checks balances at its checkpoint', async () => {
   const mongo = await startMemoryMongo()
   try {
     const launch = await getV1Launch(token!)
     expect(launch?.exists).toBe(true)
     expect(launch?.nativeQuote).toBe(true)
     let result = null
     let cycles = 0
     do {
       result = await indexLaunchHolders({ tokenAddress: token! })
       cycles++
       if (cycles > 100) throw new Error('Backfill did not finish within budget')
     } while (result?.incomplete)
     expect(result).not.toBeNull()
     expect(result!.holders.length).toBeGreaterThan(0)
     const decimals = await publicClient().readContract({ address: launch!.token, abi: ERC20_ABI, functionName: 'decimals' })
     const checks = []
     for (const holder of result!.holders.slice(0, 10)) {
       const raw = await publicClient().readContract({ address: launch!.token, abi: ERC20_ABI, functionName: 'balanceOf',
         args: [holder.wallet as `0x${string}`], blockNumber: BigInt(result!.lastIndexedBlock) })
       const balance = Number(formatUnits(raw, decimals))
       expect(holder.balance).toBeCloseTo(balance, 6)
       checks.push({ wallet: holder.wallet, indexed: holder.balance, onChain: balance })
     }
     writeFileSync('C:/Users/perci/Documents/Codex/2026-09-10/familiarize-with-the-codebase-and-commit/work/pons-retrieval.json',
       JSON.stringify({ token, pool: launch!.pool, cycles, lastIndexedBlock: result!.lastIndexedBlock,
         holderCount: result!.holders.length, withCostBasis: result!.holders.filter(h => h.vwap != null).length, checks }, null, 2))
   } finally { await stopMemoryMongo(mongo) }
 }, 300000)
})
