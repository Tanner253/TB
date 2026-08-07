import { PublicKey } from '@solana/web3.js'

/** Platform treasury — receives 12% dev fee from every SaaS tenant (env-only, not user-supplied). */
export function getPlatformDevWalletAddress(): string {
  return (process.env.DEV_WALLET_ADDRESS || '').trim()
}

export function requirePlatformDevWalletAddress(): string {
  const address = getPlatformDevWalletAddress()
  if (!address) {
    throw new Error('TopBlast is not fully configured yet. Please try again later.')
  }
  try {
    // eslint-disable-next-line no-new
    new PublicKey(address)
  } catch {
    throw new Error('TopBlast platform configuration is invalid. Please contact support.')
  }
  return address
}
