import { isContractBytecode, isEip7702Delegation } from '@/lib/evm/bytecode'

/**
 * The bytecode that got a real winner silently deleted from a live payout:
 * 0x8fe434f6…3287, first in line with a $132 loss on blasty, whose wallet is
 * an EIP-7702 delegated EOA. `code !== '0x'` called it a contract.
 */
const WINNER_7702 = '0xef0100e6cae83bde06e4c305530e199d7217f42808555b'
const CURVE_CODE = '0x6080604052348015600f57600080fd5b50600436106100...'

describe('contract detection must not exclude EIP-7702 wallets', () => {
  it('recognises the winner that was being dropped as a person, not a contract', () => {
    expect(isEip7702Delegation(WINNER_7702)).toBe(true)
    expect(isContractBytecode(WINNER_7702)).toBe(false)
  })

  it('still treats real deployed code as a contract', () => {
    expect(isContractBytecode(CURVE_CODE)).toBe(true)
    expect(isEip7702Delegation(CURVE_CODE)).toBe(false)
  })

  it('treats an empty account as not a contract', () => {
    for (const empty of ['0x', '', null, undefined]) {
      expect(isContractBytecode(empty)).toBe(false)
    }
  })

  it('requires the exact 23-byte designator shape', () => {
    // right prefix, wrong length — not a delegation, so it IS contract code
    expect(isEip7702Delegation('0xef0100abcd')).toBe(false)
    expect(isContractBytecode('0xef0100abcd')).toBe(true)
    // 0xef01 prefix that is not version 00
    expect(isEip7702Delegation('0xef0101' + 'a'.repeat(40))).toBe(false)
  })

  it('is case-insensitive on the delegate address', () => {
    expect(isEip7702Delegation('0xEF0100' + 'A'.repeat(40))).toBe(true)
  })
})
