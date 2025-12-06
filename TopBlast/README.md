# Topblast - Loss-Mining Protocol

The world's first Loss-Mining Protocol on Solana. Get paid for being a top blaster.

## Overview

Topblast rewards token holders who experience the largest losses. Every hour, the top 3 losers (ranked by drawdown percentage, with USD loss as tiebreaker) receive payouts from the reward pool:

- **1st Place**: 80%
- **2nd Place**: 15%
- **3rd Place**: 5%

## Features

- 📊 Real-time leaderboard with countdown timer
- 💰 Automated hourly payouts via Vercel Cron
- 📈 VWAP-based drawdown calculations
- 🏆 Full payout history with transaction links
- 🔒 Anti-gaming mechanics (winner cooldown, transfer detection)

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB database (MongoDB Atlas recommended)
- Helius API key
- Solana wallet with tokens for payouts

### Installation

```bash
cd TB
npm install
```

### Environment Setup

Copy `env.example.txt` to `.env.local` and fill in:

```env
MONGODB_URI=mongodb+srv://...
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...
HELIUS_API_KEY=...
TOKEN_MINT_ADDRESS=...
PAYOUT_WALLET_PRIVATE_KEY=...
CRON_SECRET=...
```

### Development

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/leaderboard` | GET | Current rankings & countdown |
| `/api/leaderboard/history` | GET | Past payout cycles |
| `/api/pool` | GET | Reward pool status |
| `/api/stats` | GET | Protocol statistics |
| `/api/countdown` | GET | Next payout countdown |
| `/api/cron/snapshot` | POST | Trigger snapshot (protected) |
| `/api/cron/payout` | POST | Trigger payout (protected) |

## Eligibility Rules

To qualify for payouts, holders must:

1. Hold minimum token amount (configurable)
2. Hold for minimum duration (1 hour)
3. Loss exceeds 10% of current pool value
4. No transfers out in last hour
5. Not won in last cycle

## Testing

For development testing:

```bash
# Trigger snapshot manually
curl -X POST http://localhost:3001/api/cron/snapshot

# Trigger payout manually
curl -X POST http://localhost:3001/api/cron/payout
```

## Deployment

Deploy to Vercel:

```bash
vercel deploy --prod
```

Cron jobs are configured in `vercel.json`:
- Snapshot runs at minute 55 of each hour
- Payout runs at minute 0 of each hour

## Architecture

```
TB/
├── app/
│   ├── api/
│   │   ├── leaderboard/      # Rankings API
│   │   ├── cron/             # Automated jobs
│   │   ├── pool/             # Pool status
│   │   └── stats/            # Statistics
│   ├── leaderboard/          # Leaderboard page
│   ├── history/              # History page
│   └── stats/                # Stats page
├── lib/
│   ├── db/                   # Database schema & connection
│   ├── engine/               # Calculation logic
│   └── solana/               # Blockchain interactions
└── whitepaper/               # Project whitepaper
```

## License

MIT

