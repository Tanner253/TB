/**
 * Is this account a contract, for the purpose of excluding it from rewards?
 *
 * The exclusion exists to keep protocol machinery — bonding curves, routers,
 * LP pools — out of the leaderboard. A naive `code !== '0x'` test also catches
 * something it must not: an EIP-7702 delegated EOA. Since Pectra, a plain user
 * wallet can set a 23-byte delegation designator (`0xef0100` + the address of
 * a smart-account implementation) and from then on `eth_getCode` returns it.
 * MetaMask Smart Accounts, Coinbase and Ambire wallets all do this by default.
 *
 * That wallet is still a person. Treating it as a contract silently deleted
 * real holders from payouts on every tenant — a wallet with a $132 loss, first
 * in line, vanished from the winner list with no error anywhere.
 */

/** EIP-7702: 0xef0100 || 20-byte delegate address, exactly 23 bytes. */
const EIP7702_DESIGNATOR = /^0xef0100[0-9a-f]{40}$/i

export function isEip7702Delegation(code: string | null | undefined): boolean {
  return EIP7702_DESIGNATOR.test((code ?? '').trim())
}

/** True only for deployed contract code — never for an empty account or a 7702 EOA. */
export function isContractBytecode(code: string | null | undefined): boolean {
  const c = (code ?? '0x').trim()
  if (c === '0x' || c === '') return false
  if (isEip7702Delegation(c)) return false
  return true
}
