# TopBlast → Robinhood Chain + Pons migration

Branch: `feat/robinhood-chain-migration`. **`main` and the live Solana
deployment are untouched.** Goal: the app behaves *exactly* the same, but runs
on Robinhood Chain (EVM) and lists Pons tokens instead of Solana / pump.fun.

---

## 1. Verified facts (checked live 2026-09-10, not assumed)

### Chain

| Thing | Value | Status |
| :-- | :-- | :-- |
| Mainnet chain id | `4663` (`0x1237`) | ✅ confirmed via `eth_chainId` |
| Mainnet RPC | `https://rpc.mainnet.chain.robinhood.com` | ✅ live, ~block 59.5M |
| Testnet chain id / RPC | `46630` / `rpc.testnet.chain.robinhood.com` | from old code — retest |
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | ✅ `symbol()` → `WETH` |
| Native currency | ETH, **18 decimals** (vs SOL 9) | — |
| Explorer | Blockscout `robinhoodchain.blockscout.com` | ⚠️ see risks |

### Pons (launchpad — the pump.fun replacement)

Real domain is **ponsfamily.com** (`pons.family` does not resolve). Docs at
`docs.ponsfamily.com`; contracts at `github.com/ponsdotdev/ponsfamily`.

| Thing | Value |
| :-- | :-- |
| V1 Factory (active) | `0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB` (start block 8991118) — ✅ 24,353 bytes deployed |
| V1 Locker | `0x736D76699C26D0d966744cAe304C000d471f7F35` — ✅ 5,426 bytes deployed |
| V1 Factory (legacy) | `0x0c37a24F5D23A486FA692d1500881d698B1F77a4` (start block 8600612) |
| **V2 Factory** | `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e` — ✅ 24,177 bytes deployed |
| **V2 Fee Escrow** | `0xd3afeb2a57f70ef218aa82451c51b2fb0416ac9e` — ✅ 1,932 bytes, resolved via `feeEscrow()` |
| **V2 Locker** | `0x267444d099b10fb5ed7c3cc7b7c767adca574952` — resolved via `locker()` |
| Trading fee | **1% per trade, split 70% creator / 30% protocol** |
| Launch fee | 0.0005 ETH |
| Graduation | at **4.2 ETH** paired WETH; the pool does *not* migrate — trading continues in the same Uniswap **V3** pool |
| Graduation read | `graduationStatus(address token)` → (pairedPrincipal, threshold, graduated) |
| Scale | ~4.2M tokens launched, 868 graduated |

### DEX + pricing

- **DexScreener already supports Robinhood Chain** (`chainId: "robinhood"`),
  returning `priceUsd`, `marketCap`, `liquidity`. Our existing DexScreener
  provider works with a chain-filter change — pricing is nearly free to port.
- Both **Uniswap V3** (WETH pairs, Pons V1) and **Uniswap V4** (native-ETH
  pairs, Pons V2) exist on-chain.

---

## 2. Open questions (must resolve before payouts can run)

1. ~~**Creator-fee claim ABI.**~~ **RESOLVED — verified in deployed bytecode.**
   Pons **V2 is live on mainnet** (contrary to the `pons-fork-v2` README, whose
   addresses were unpublished at the time of writing). Creator fees are pulled
   from the **Fee Escrow** at `0xd3afeb2a57f70ef218aa82451c51b2fb0416ac9e`,
   discovered by calling `feeEscrow()` on the V2 factory. Both selectors are
   present in the deployed code:

   | Selector | Signature | Use |
   | :-- | :-- | :-- |
   | `0x4e71d92d` | `claim()` | aggregated claim across all assets |
   | `0x32f289cf` | `claimToken(address asset)` | per-asset claim (ETH or ERC-20) |

   Called by the **creator wallet** — i.e. the payout wallet a launcher
   registers with us — which maps almost 1:1 onto today's
   `lib/pump/collectCreatorFees.ts` flow. Still to confirm: a view for
   *pending* balances (no `claimable`/`balances` getter matched the escrow
   bytecode, so we may need to derive pending amounts from escrow events, or
   simply attempt `claim()` on the existing throttle and treat a no-op as
   "nothing to claim" — which is what the pump.fun collector already does).

   Discovery is reproducible: `getLaunchedToken(address)` exists on both
   factories and the V1 locker; `graduationStatus(address)` on the V1 factory.

2. **V1 vs V2 targeting.** Both generations are deployed. V2 has the clean
   escrow-based claim above and graduates into Uniswap V4; V1 accrues fees
   inside a locked Uniswap V3 position. Recommend building against **V2**
   (new launches use it — the site badges tokens "V2") and treating V1 as
   read-only/legacy.

3. **Uniswap router addresses** for the buyback swap. V3 SwapRouter is in the
   Pons docs' core-addresses section; the V4 Universal Router is reportedly
   unpublished (the reference bot throws `NeedsV4Router`).
4. **Block time**, to size `eth_getLogs` windows and tune the indexer cursor.

---

## 3. Risks

- **Blockscout sits behind a Cloudflare challenge.** Server-side requests get
  the "Just a moment…" interstitial even with a browser UA, so the old
  `lib/evm/indexer.ts` Blockscout path **will not work from Vercel**.
  *Mitigation, already proven:* `eth_getLogs` on the public RPC returns ERC-20
  `Transfer` logs fine (tested over a 2000-block range — no key, no
  challenge). Build holder + cost-basis indexing on raw RPC with an
  incremental block cursor in Mongo. Bitquery publishes a Pons API as a paid
  fallback.
- **Encrypted payout keys change format** (base58 Solana → 32-byte hex EVM).
  Existing tenant rows cannot carry over; validation and address derivation
  both change. Fine for a fresh deployment, but it is a hard cutover.
- **Decimals: 9 → 18 everywhere.** Anything using `LAMPORTS_PER_SOL` or
  assuming 9 decimals moves to `parseEther` / `formatUnits(…, 18)`. Dust
  thresholds and `MIN_TRANSFER_SOL` need re-tuning.

---

## 4. Assets already recovered (big head start)

Git history contains a **complete pre-Solana EVM implementation** (commit
`ba52ada` "robinhood evm support", deleted in `a5b1792`). Restored to
`TopBlast/lib/evm/` on this branch — 1,118 lines, viem-based:

| File | Lines | Reuse |
| :-- | --: | :-- |
| `indexer.ts` | 682 | holders, Transfer/Swap parsing, `ParsedTransaction` with `ethAmount` — the VWAP source |
| `price.ts` | 177 | token price, ETH price, market cap |
| `transfer.ts` | 165 | native ETH payouts via viem wallet client |
| `chain.ts` | 45 | chain ids, RPC, Blockscout bases |
| `holders.ts` | 30 | holder shaping |
| `explorer.ts` | 19 | Blockscout tx/address URLs |

Caveat: it predates the multi-tenant SaaS rewrite, Birdeye, `payoutMode` and
the analytics layer — treat it as a **porting base, not a drop-in**. `viem` is
no longer in `package.json` and must be re-added.

---

## 5. Migration surface

48 files import `@solana/*`, `lib/solana/*`, or `@pump-fun`:
`lib/solana` (9) · `lib/payout` (9) · `lib/platform` (6) · `lib/tracker` (3) ·
`lib/tenant` (2) · `lib/pump` (2) · `lib/eligibility` (2) · `hooks` (2) ·
`lib/stats`, `lib/rekt`, `lib/leaderboard`, `app/winners`, `app/leaderboard`,
`app/api/webhook/helius` (1 each).

| Solana today | Robinhood Chain replacement |
| :-- | :-- |
| Helius RPC/DAS + Birdeye holders | `eth_getLogs` Transfer indexing on public RPC (+ Mongo block cursor) |
| Helius enhanced tx → VWAP | Uniswap `Swap` / `Transfer` log parsing → cost basis |
| Jupiter swap (buyback) | Uniswap V3 SwapRouter (V4 Universal Router later) |
| SPL token transfer (airdrop) | ERC-20 `transfer` via viem |
| SOL transfer (dev fee / SOL payout mode) | native ETH transfer via viem |
| pump.fun creator-fee collect | Pons Locker / Fee Escrow claim |
| DexScreener `chainId: solana` | DexScreener `chainId: robinhood` (works today) |
| Solscan links | Blockscout links |
| base58 keys / `PublicKey` | hex keys / viem `isAddress` |

**Recommended sequencing** — swap implementations *behind the existing module
boundaries first* (fastest route to a working local test, minimal churn on the
900-line leaderboard page and the payout executor), then do a mechanical
rename pass (`lib/solana/*` → `lib/chain/*`) once green.

The payout executor, eligibility rules, timer/lock logic, analytics, Rekt
cards, Hall of Fame, game and UI are **chain-agnostic** and should need no
changes beyond currency labels.

---

## 6. Test plan (local, before any deploy)

1. **Testnet (46630) end-to-end**: launch a Pons token, fund a payout wallet,
   run one full cycle — index → eligibility → claim → swap → airdrop.
2. **Keep the existing suite green.** 349 tests pass today; the chain-agnostic
   suites must stay green throughout, with new EVM suites mirroring the Solana
   ones.
3. **Dry run**: `EXECUTE_PAYOUTS=false` against mainnet data to validate
   indexing and eligibility with zero on-chain writes.
