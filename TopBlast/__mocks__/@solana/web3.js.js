class PublicKey {
  constructor(value) {
    if (Buffer.isBuffer(value)) {
      this._bytes = value
      this._key = value.toString('hex').slice(0, 44).padEnd(44, '1')
      return
    }

    if (!value || (typeof value === 'string' && value.length < 32)) {
      throw new Error('Invalid public key input')
    }

    this._key = String(value)
    this._bytes = Buffer.alloc(32, 0)
  }

  toBase58() {
    return this._key
  }

  toBuffer() {
    return this._bytes ?? Buffer.alloc(32, 0)
  }

  static findProgramAddressSync(seeds, programId) {
    const seedKey = seeds
      .map(seed => (Buffer.isBuffer(seed) ? seed.toString('hex') : String(seed)))
      .join('|')
    const pda = `PDA${seedKey}${programId.toBase58()}`.slice(0, 44).padEnd(44, '1')
    return [new PublicKey(pda), 255]
  }
}

class Keypair {
  constructor() {
    this.publicKey = new PublicKey('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuQosgAsU')
  }

  static fromSecretKey(_secretKey) {
    return new Keypair()
  }

  static generate() {
    return new Keypair()
  }
}

module.exports = {
  Keypair,
  PublicKey,
  Connection: jest.fn().mockImplementation(() => ({
    getLatestBlockhash: jest.fn(),
    sendRawTransaction: jest.fn(),
    confirmTransaction: jest.fn(),
    getBalance: jest.fn().mockResolvedValue(1_000_000_000),
  })),
  SystemProgram: {
    transfer: jest.fn(),
  },
  LAMPORTS_PER_SOL: 1_000_000_000,
  Transaction: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    sign: jest.fn(),
    serialize: jest.fn().mockReturnValue(Buffer.from([])),
  })),
}
