import 'server-only'

import { AsyncLocalStorage } from 'async_hooks'
import type { TenantRuntimeConfig } from './types'

const tenantStorage = new AsyncLocalStorage<TenantRuntimeConfig>()

export function getTenantRuntime(): TenantRuntimeConfig | undefined {
  return tenantStorage.getStore()
}

export function getTenantSlug(): string {
  return getTenantRuntime()?.tenantSlug ?? '_legacy'
}

export function getPayoutPrivateKey(): string | undefined {
  const runtime = getTenantRuntime()
  if (runtime?.payoutWalletPrivateKey) return runtime.payoutWalletPrivateKey
  return process.env.PAYOUT_WALLET_PRIVATE_KEY || undefined
}

export async function runWithTenant<T>(
  runtime: TenantRuntimeConfig,
  fn: () => Promise<T>
): Promise<T> {
  return tenantStorage.run(runtime, fn)
}
