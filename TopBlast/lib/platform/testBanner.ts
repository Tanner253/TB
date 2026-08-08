import 'server-only'

import { config } from '@/lib/config'
import { getPlatformTokenMint } from '@/lib/platform/config'
import { isPlatformEnvConfigured } from '@/lib/platform/envPlatform'

export interface PlatformTestBanner {
  label: string
  message: string
}

/** Hardcoded until official platform token launch — remove with testBanner module. */
export const HARDCODED_PLATFORM_TEST_BANNER: PlatformTestBanner = {
  label: 'TEST',
  message: 'NOT OFFICIAL TOKEN',
}

/** Leaderboard only: env-driven platform token (TOKEN_MINT_ADDRESS + payout key), not SaaS tenants. */
export function getPlatformTestBanner(): PlatformTestBanner | null {
  if (!isPlatformEnvConfigured()) return null
  if (config.tenantSlug !== '_legacy') return null

  const platformMint = getPlatformTokenMint()
  if (!platformMint || config.tokenMint !== platformMint) return null

  return HARDCODED_PLATFORM_TEST_BANNER
}
