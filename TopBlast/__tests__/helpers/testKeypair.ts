/** Fake Solana secret key for unit tests only — no real funds, safe to commit. */
export const TEST_SOLANA_SECRET_KEY =
  '5JrusiMCSTnF6xdfs98GdS4rMuvsVaSqE6r7zmtq78avb4KxvkDSQcxenzVaYotwEPvQuwGkFdL9TaR6L97y5brg'

export function testSolanaSecretKey(): string {
  return TEST_SOLANA_SECRET_KEY
}
