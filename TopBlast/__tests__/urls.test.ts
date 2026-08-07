import { APP_URL, WHITEPAPER_URL, appHostname, APP_HOSTNAME } from '@/lib/marketing/urls'

describe('marketing urls', () => {
  it('uses fixed production URLs', () => {
    expect(APP_URL).toBe('https://www.topblastweb3.xyz')
    expect(WHITEPAPER_URL).toBe('https://topblastx100.vercel.app')
    expect(APP_HOSTNAME).toBe('www.topblastweb3.xyz')
    expect(appHostname()).toBe('www.topblastweb3.xyz')
  })
})
