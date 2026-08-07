import 'server-only'

/** Strip likely private keys / secrets before logging or returning API errors. */
export function redactSecrets(text: string): string {
  if (!text) return text
  return text
    .replace(/[1-9A-HJ-NP-Za-km-z]{80,88}/g, '[REDACTED_KEY]')
    .replace(/0x[a-fA-F0-9]{40,64}/g, '[REDACTED_KEY]')
}

export function assertNoPrivateKeyFields(payload: Record<string, unknown>): void {
  const forbidden = [
    'payoutWalletPrivateKey',
    'privateKey',
    'secretKey',
    'encryptedPayoutKey',
    'PAYOUT_WALLET_PRIVATE_KEY',
  ]
  for (const key of forbidden) {
    if (key in payload && payload[key] != null && payload[key] !== '') {
      throw new Error(`Refusing to expose secret field: ${key}`)
    }
  }
}
