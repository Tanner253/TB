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
| **V2 Locker** | `0x267444D099b10fB5Ed7c3Cc7B7c767AdcA574952` — matches on-chain `locker()` |
| **V2 Meme hook** (Uniswap V4) | `0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044` |
| **V2 Buyback vault** | `0x42df2a798f82289E177311362e8f5ccC45c1219c` |
| **V2 Launch and buy** | `0xe33E9E479dF8802cb0866d5d05258bEc4cF62948` |
| **V2 Launch deployer** | `0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42` |
| **V2 Graduation executor** | `0xC7819B64A1dAECD7eC19856d026cb14EfBd89046` |
| **V2 Graduation guard** | `0xf5695117b99B6f6401e67d4195BD653628176C6C` |
| **Uniswap V4 PoolManager** | `0x8366a39cc670b4001a1121b8f6a443a643e40951` (via hook `poolManager()`) |
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

   The docs publish the full escrow ABI, and **every function is verified
   present in the deployed bytecode**:

   | Selector | Signature | Use |
   | :-- | :-- | :-- |
   | `0x70a08231` | `balanceOf(address recipient)` | ETH owed to a creator |
   | `0xf59e38b7` | `balanceOfToken(address recipient, address token)` | ERC-20 owed |
   | `0x4e71d92d` | `claim()` | claim the native (ETH) ledger |
   | `0x32f289cf` | `claimToken(address token)` | claim one asset's ledger |

   Fees are **credited to an escrow, not pushed**, so a recipient that cannot
   receive a transfer can never block a sweep for everyone else. The escrow
   keeps a native ledger *and* a per-token ledger: native-quote launches
   credit the former, custom-pair launches credit the latter under their
   quote asset, and a released buyback vest credits it under the launch
   token. A creator with launches against several quote assets holds several
   separate balances and claims each independently.

   Called by the **creator wallet** — i.e. the payout wallet a launcher
   registers with us — which maps almost 1:1 onto today's
   `lib/pump/collectCreatorFees.ts` flow. Because `balanceOf` / `balanceOfToken` expose pending amounts, the
   collector can check what is actually owed *before* spending gas — an
   improvement on the pump.fun path, which has to attempt and no-op.

   Discovery is reproducible: `getLaunchedToken(address)` exists on both
   factories and the V1 locker; `graduationStatus(address)` on the V1 factory.

2. ~~**V1 vs V2 targeting.**~~ **DECIDED: V2 only.** V1 is legacy
   (Uniswap V3, fees accruing inside a locked position); V2 is what new
   launches use and has the clean escrow claim above.

3. **Swap execution — mostly RESOLVED.** Pons v2 tokens trade in **two
   places over their life**, so the buyback has two paths.

   **(a) Pre-graduation — no router needed at all.** Buy straight off the
   bonding curve (docs, "Buying and selling"):

   ```solidity
   function buy(uint256 quoteIn, uint256 minTokensOut, address recipient)
       payable returns (uint256 tokensOut)
   function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient)
       returns (uint256 quoteOut)
   function isNativeQuote() view returns (bool)
   function pairToken() view returns (address)
   ```

   For a native-quote launch `quoteIn` must equal `value`, and refunds come
   back in the same tx. This is *simpler than Jupiter* — a direct contract
   call with built-in slippage protection via `minTokensOut`.

   **Quoting:** the curve exposes no quote function. Reproduce its
   constant-product maths locally from `getReserves()`, `sellableTokens()`,
   `feeBps()`, `creatorTaxBps()` and `currentSnipeTaxBps(address)` — the docs
   publish the exact integer order, so a local quote matches settlement.

   **(b) Post-graduation — an ordinary Uniswap V4 pool.** Docs: *"There is
   nothing pons-specific about swapping it, so any v4-aware router or
   aggregator can trade it without integrating against pons at all."*

   - **V4 PoolManager `0x8366a39cc670b4001a1121b8f6a443a643e40951`** —
     found on-chain via `poolManager()` on the Pons Meme hook.
   - Pool key: currencies sorted by address (native ETH = `0x0` always takes
     `currency0`), `fee: 0` (the hook charges the fee, not the pool),
     `tickSpacing` from the launch record, `hooks` = the Pons Meme hook.
   - **Still open:** the canonical Universal Router address on this chain.
     If none is deployed, the options are (i) swap directly against
     PoolManager through its `unlock()` callback with our own small periphery
     contract, or (ii) ship curve-only buybacks first — most TopBlast
     listings will be pre-graduation anyway, so this does not block launch.

   For reference, Pons **V1** (legacy) rides Uniswap V3:
   V3 factory `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA`,
   Swap router `0xCaf681a66D020601342297493863E78C959E5cb2`,
   Quoter V2 `0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7`,
   Position manager `0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3`.

4. ~~**Block time.**~~ **RESOLVED — and it materially shapes the indexer.**
   **0.101 s per block, roughly 853,000 blocks/day.** Measured `eth_getLogs`
   limits against the public RPC:

   | Span | Result |
   | :-- | :-- |
   | 10,000 blocks (~17 min) | 33 logs, 109 ms |
   | 100,000 blocks (~2.8 h) | 623 logs, 168 ms |
   | 1,000,000 blocks | `logs matched by query exceeds limit of 10000` |
   | 5,000,000+ blocks | HTTP 429, rate limited |

   The indexer therefore needs **adaptive windowing** (halve the range when
   the 10k-log cap trips, back off on 429) plus a persisted block cursor.
   Filtering by token address keeps volumes low, and backfill starts at each
   token's launch block (from the factory's `TokenLaunched` event) rather
   than chain genesis. A paid or private RPC is likely wanted for production
   throughput.

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
