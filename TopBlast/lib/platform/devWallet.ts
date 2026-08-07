import { PublicKey } from '@solana/web3.js'

/** Platform treasury — receives 12% dev fee from every SaaS tenant (env-only, not user-supplied). */
export function getPlatformDevWalletAddress(): string {
  return (process.env.DEV_WALLET_ADDRESS || '').trim()
}

export function requirePlatformDevWalletAddress(): string {
  const address = getPlatformDevWalletAddress()
  if (!address) {
    throw new Error('DEV_WALLET_ADDRESS must be configured on the server')
  }
  try {
    // eslint-disable-next-line no-new
    new PublicKey(address)
  } catch {
    throw new Error('DEV_WALLET_ADDRESS must be a valid Solana pubkey')
  }
  return address
}
