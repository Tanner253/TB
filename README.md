# TopBlast

**Loss-mining rewards and on-chart volume for Solana token launchers.**

TopBlast is a self-serve SaaS platform that turns creator-fee SOL into two things every cycle: **real buy pressure on your chart** and **token airdrops to your most underwater holders**. Winners compete by drawdown — not by farming sell-side volume for rebates.

[Live app](https://topblasted.fun) · [Launch a listing](https://topblasted.fun/launch) · [Catalog](https://topblasted.fun/catalog) · [Whitepaper](https://whitepaper.topblasted.fun)

---

## What TopBlast does

Most cashback bots pay SOL rebates for **volume traded on chart** — often sell-side. That rewards trading activity, not holders. TopBlast routes the winner pool differently:

1. **Fund a payout wallet** with creator-fee SOL (you control the budget).
2. **Each cycle**, ~88% of pool SOL swaps into **your session token via Jupiter** — measurable on-chart volume.
3. **Purchased tokens airdrop** to the top 3 eligible underwater holders (60% / 25% / 15%).
4. **12% protocol fee** goes to the TopBlast platform treasury (buyback + ops flywheel).

That makes TopBlast both a **loss-mining protocol** and a **chart volume engine**. Lifetime SOL bought on-chart is tracked as **Gen volume** on every catalog listing.

---

## Why launchers use it

| | Cashback / rebates | TopBlast |
|---|-------------------|----------|
| Holder behavior | Trade for SOL rebates | Hold underwater to qualify |
| Chart effect | Sell-side volume rewarded | Jupiter buys your token each cycle |
| Rewards | Exit liquidity (SOL) | Your session token |
| Volume | None | Gen volume tracked in catalog |

---

## Payout cycle (per listing)

```
Creator-fee SOL (payout wallet)
        │
        ▼
   ~99% of wallet balance used each cycle
        │
        ├─ 88% winner pool ──► Jupiter buy (your mint) ──► SPL airdrop top 3 losers
        │
        └─ 12% protocol fee ──► platform treasury (6% buyback / 6% ops)
```

**Winner split:** 1st 60% · 2nd 25% · 3rd 15% of the winner pool (after dev fee).

**Payout frequency:** chosen at launch — 15m, 30m, 1h, 2h, 4h, or 6h. Timer starts when the first eligible holder appears.

**Default payout mode:** `PAYOUT_AS_NATIVE_TOKEN=true` — winners receive your token, not SOL. Set `false` for legacy SOL payouts.

---

## Platform features

### For token launchers

- **Self-serve launch** at `/launch` — mint, ticker, payout wallet key (encrypted at rest), cycle length, min balance
- **Isolated sessions** — each listing gets `/[slug]/leaderboard`, `/history`, `/stats`
- **Live catalog** — sort by pot, Gen volume, or total paid out
- **Session diagnostics** — clear status when pool is empty, indexing, or no eligible holders
- **Pump.fun → migration** — DexScreener price follows bonding curve and Raydium/PumpSwap pairs

### For holders

- **VWAP drawdown rankings** from on-chain buy history (Helius)
- **Eligibility gates** — min balance, 15m hold, dynamic min loss (10% of pool USD), no sells/transfers out, winner cooldown
- **Automatic airdrops** — no claim button; tokens arrive wallet-to-wallet

### Chart volume (Gen volume)

Each successful payout cycle with eligible winners:

1. Swaps winner-pool SOL → session token on Jupiter (with slippage retries).
2. Records SOL spent as **generated volume** on the tenant (`total_generated_volume_sol` / USD).
3. Surfaces in the **catalog** and listing cards as **Gen volume** — lifetime on-chart buy pressure from the protocol.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| App | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Chain | Solana mainnet — Helius RPC/DAS, `@solana/web3.js`, SPL |
| Swaps | Jupiter (SOL → session token) |
| Database | MongoDB (tenants, holders, payouts, encrypted keys) |
| Pricing | DexScreener (+ Jupiter/Helius server fallbacks) |
| Hosting | Vercel |

---

## Repository layout

```
TB/
├── TopBlast/          # Main Next.js app (app, API, payout engine)
├── whitepaper/        # Marketing docs site
└── README.md          # This file
```

Key TopBlast paths:

```
TopBlast/
├── app/
│   ├── page.tsx              # Homepage
│   ├── launch/               # Self-serve listing form
│   ├── catalog/              # Multi-tenant catalog
│   ├── leaderboard/          # Platform token session
│   ├── [slug]/               # Per-tenant session pages
│   └── api/
│       ├── tenants/          # Catalog + launch API
│       ├── cron/tenants/     # Multi-tenant payout cron
│       └── t/[slug]/         # Tenant-scoped APIs
├── lib/
│   ├── payout/executor.ts    # Payout + Jupiter swap + airdrop
│   ├── solana/jupiterSwap.ts
│   ├── platform/catalogMetrics.ts  # Gen volume aggregation
│   └── tenant/               # Multi-tenant runtime
└── env.example.txt
```

---

## Getting started (local dev)

### Prerequisites

- Node.js 18+
- MongoDB (Atlas or local)
- Helius API key ([helius.dev](https://helius.dev))

### Install

```bash
git clone https://github.com/Tanner253/TB.git
cd TB/TopBlast
npm install
cp env.example.txt .env.local
# Edit .env.local — see env.example.txt
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Tests

```bash
cd TopBlast
npm test
```

---

## Environment (essentials)

See `TopBlast/env.example.txt` for the full list. Critical vars:

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | Database |
| `HELIUS_API_KEY` | Holder indexing + tx history |
| `TENANT_ENCRYPTION_KEY` | Encrypt launcher payout keys at rest |
| `PAYOUT_AS_NATIVE_TOKEN` | `true` = Jupiter buy + token airdrop (default) |
| `PAYOUT_SWAP_MAX_RETRIES` | Slippage escalation retries (default 3) |
| `EXECUTE_PAYOUTS` | `true` in production to sign transactions |
| `DEV_WALLET_ADDRESS` | Receives 12% protocol fee each cycle |
| `PLATFORM_TENANT_SLUG` | Platform token catalog slug (default `topblast`) |

---

## API overview

### Public

| Endpoint | Description |
|----------|-------------|
| `GET /api/tenants` | Catalog listings (pot, Gen volume, status) |
| `GET /api/leaderboard` | Platform token rankings |
| `GET /api/t/[slug]/leaderboard` | Tenant rankings |
| `GET /api/history` | Payout history |
| `GET /api/stats` | Session stats |

### Protected (cron / admin)

| Endpoint | Description |
|----------|-------------|
| `POST /api/cron/tenants` | Run snapshots + payouts for all active tenants |
| `POST /api/cron/snapshot` | Legacy single-token snapshot |
| `POST /api/cron/payout` | Legacy single-token payout |

Payouts also trigger when the leaderboard timer reaches zero during API polling.

---

## Security

- Launcher payout private keys encrypted with AES-256-GCM before storage
- Keys decrypted only during that listing's payout execution
- Cron and admin routes require `CRON_SECRET`
- Dev wallet and payout wallet excluded from rankings
- No wallet connect on the frontend — read-only UI for holders

---

## Roadmap

- [x] Solana loss-mining with VWAP drawdown rankings
- [x] Multi-tenant SaaS (`/launch`, catalog, encrypted keys)
- [x] Native-token payouts (Jupiter buy + SPL airdrop)
- [x] Gen volume tracking in catalog
- [x] Payout slippage retries + failure persistence
- [ ] Automated platform-token buyback + burn bot
- [ ] Public analytics API for launchers

---

## Links

- **App:** [topblasted.fun](https://topblasted.fun)
- **Docs / whitepaper:** [whitepaper.topblasted.fun](https://whitepaper.topblasted.fun)
- **GitHub:** [github.com/Tanner253/TB](https://github.com/Tanner253/TB)
- **X:** [@oSKNYo_dev](https://x.com/oSKNYo_dev)

---

<div align="center">

*When you drawdown, we blast you up.*

</div>
