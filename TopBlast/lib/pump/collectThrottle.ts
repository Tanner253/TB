import 'server-only'

import { pumpCollectThrottleMs } from '@/lib/pump/config'

declare global {
  // eslint-disable-next-line no-var
  var _pumpCollectLastAttempt: Map<string, number> | undefined
}

function getAttemptMap(): Map<string, number> {
  if (!global._pumpCollectLastAttempt) {
    global._pumpCollectLastAttempt = new Map()
  }
  return global._pumpCollectLastAttempt
}

export function shouldThrottlePumpCollect(tenantKey: string): boolean {
  const last = getAttemptMap().get(tenantKey)
  if (last == null) return false
  return Date.now() - last < pumpCollectThrottleMs()
}

export function markPumpCollectAttempt(tenantKey: string): void {
  getAttemptMap().set(tenantKey, Date.now())
}

/** Test helper */
export function resetPumpCollectThrottle(): void {
  global._pumpCollectLastAttempt = undefined
}
