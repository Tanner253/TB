class PublicKey {
  constructor(value) {
    if (!value || value.length < 32) {
      throw new Error('Invalid public key input')
    }
    this._key = value
  }

  toBase58() {
    return this._key
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
