import type { NextRequest } from 'next/server'
import { config } from '@/lib/config'

/** Fail closed in production — cron/admin routes must present CRON_SECRET. */
export function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) {
    return config.isDev
  }
  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${cronSecret}`
}

export function requireCronSecretInProduction(): void {
  if (config.isProd && !process.env.CRON_SECRET?.trim()) {
    throw new Error('CRON_SECRET is required in production')
  }
}
