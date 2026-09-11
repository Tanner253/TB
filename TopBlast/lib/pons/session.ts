import { isAddress } from 'viem'
import { config } from '@/lib/config'
/** Legacy Solana listings remain readable; EVM listings always use Pons. */
export function isPonsSession(mint: string = config.tokenMint): boolean {
  return /^0x/i.test(mint?.trim() ?? '')
}
export function isEvmAddress(value: string): boolean {
  return isAddress(value?.trim() ?? '', { strict: false }) && !/^0x0{40}$/i.test(value.trim())
}
export function walletKey(value: string): string {
  return /^0x/i.test(value) ? value.toLowerCase() : value
}
