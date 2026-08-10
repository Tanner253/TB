import axios from 'axios'
import {
  isStaleReportedHolderCount,
  resolveReportedHolderCount,
} from '@/lib/solana/birdeyeHolders'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('reported holder count', () => {
  it('treats legacy Mongo rows (reported <= ranked) as stale', () => {
    expect(
      isStaleReportedHolderCount({
        reportedHolderCount: 0,
        totalHolders: 50,
        rankings: new Array(50),
      })
    ).toBe(true)

    expect(
      isStaleReportedHolderCount({
        reportedHolderCount: 50,
        totalHolders: 50,
        rankings: new Array(50),
      })
    ).toBe(true)
  })

  it('accepts fresh reported count above leaderboard rows', () => {
    expect(
      isStaleReportedHolderCount({
        reportedHolderCount: 55,
        totalHolders: 55,
        rankings: new Array(50),
      })
    ).toBe(false)
  })

  it('resolveReportedHolderCount prefers live Birdeye when DB is stale', async () => {
    process.env.BIRDEYE_API_KEY = 'test-key'
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: { data: { holder: 55, items: [] } },
    })

    const count = await resolveReportedHolderCount('Mint1111111111111111111111111111111111', {
      reportedHolderCount: 0,
      totalHolders: 50,
      rankings: new Array(50),
    })

    expect(count).toBe(55)
    delete process.env.BIRDEYE_API_KEY
    mockedAxios.get.mockReset()
  })
})
