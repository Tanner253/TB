import { APP_URL, WHITEPAPER_URL, appHostname, APP_HOSTNAME } from '@/lib/marketing/urls'

describe('marketing urls', () => {
  it('uses fixed production URLs', () => {
    expect(APP_URL).toBe('https://topblast.family')
    expect(WHITEPAPER_URL).toBe('https://whitepaper.topblast.family')
    expect(APP_HOSTNAME).toBe('topblast.family')
    expect(appHostname()).toBe('topblast.family')
  })
})
