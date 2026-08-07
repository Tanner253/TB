import 'server-only'

import { AsyncLocalStorage } from 'async_hooks'
import { config } from '@/lib/config'

/** Payout signing runs inside runAuthorizedPayout (leaderboard due-cycle or admin/cron). */
const payoutAuthorized = new AsyncLocalStorage<boolean>()

export function runAuthorizedPayout<T>(fn: () => Promise<T>): Promise<T> {
  return payoutAuthorized.run(true, fn)
}

export function isPayoutExecutionAuthorized(): boolean {
  if (payoutAuthorized.getStore() === true) return true
  // Tests only — never bypass in production even if NODE_ENV is misconfigured.
  if (process.env.NODE_ENV === 'test') return true
  if (config.isDev && !config.isProd) return true
  return false
}
