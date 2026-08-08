import { APP_URL, WHITEPAPER_URL, appHostname, APP_HOSTNAME } from '@/lib/marketing/urls'

describe('marketing urls', () => {
  it('uses fixed production URLs', () => {
    expect(APP_URL).toBe('https://topblasted.fun')
    expect(WHITEPAPER_URL).toBe('https://whitepaper.topblasted.fun')
    expect(APP_HOSTNAME).toBe('topblasted.fun')
    expect(appHostname()).toBe('topblasted.fun')
  })
})
