import { privateKeyToAccount } from 'viem/accounts'
export function accountForKey(value: string | undefined | null) {
  const key = value?.trim().replace(/^0x/i, '')
  if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) return null
  try { return privateKeyToAccount(`0x${key}`) } catch { return null }
}
