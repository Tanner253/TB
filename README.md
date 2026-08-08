# 🚀 TOPBLAST - The Loss-Mining Protocol

<div align="center">

![Topblast Logo](https://img.shields.io/badge/TOPBLAST-Loss%20Mining%20Protocol-14F195?style=for-the-badge&logo=solana&logoColor=white)

**The world's first Loss-Mining Protocol on Solana.**  
*Get paid for being a top blaster.*

[![Solana](https://img.shields.io/badge/Built%20on-Solana-14F195?style=flat-square&logo=solana)](https://solana.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.5-green?style=flat-square&logo=mongodb)](https://mongodb.com)

[Live App](https://topblasted.fun) • [Documentation](#features) • [How It Works](#how-it-works) • [Get Started](#getting-started)

</div>

---

## 📖 What is Topblast?

Topblast flips traditional crypto trading psychology on its head. Instead of only winning when prices go up, **Topblast rewards holders who experience the largest losses**. Every hour, the top 3 "blasters" (biggest losers by drawdown percentage) automatically receive payouts from the reward pool.

### The Win-Win Scenario

| Scenario | What Happens |
|----------|-------------|
| **Price Pumps** 📈 | Your tokens appreciate in value. You win traditionally. |
| **Price Dumps** 📉 | Your drawdown increases, you climb the leaderboard, and you get paid from the reward pool. |

> *"In a market of gambling, be the casino. If you can't be the casino, be the player who gets paid to lose."*

---

## ✨ Features

### 🎯 Core Functionality

- **📊 Real-time Leaderboard** - Live rankings updated every 5 seconds with smooth animations
- **💰 Automated Hourly Payouts** - Winners paid automatically via Vercel Cron, no claiming needed
- **📈 VWAP-based Drawdown Calculations** - Accurate loss tracking using Volume-Weighted Average Price from real on-chain buy transactions
- **🏆 Full Payout History** - Complete record of all past cycles with Solscan transaction links
- **⏱️ Live Countdown Timer** - Know exactly when the next payout happens

### 🔒 Anti-Gaming Mechanics

- **Winner Cooldown** - Previous winners sit out 1 cycle
- **Transfer Detection** - Transferring tokens out triggers disqualification
- **Sell Detection** - Any sell immediately disqualifies you
- **Minimum Hold Duration** - Must hold for at least 1 hour to qualify
- **Minimum Loss Threshold** - Loss must exceed 10% of pool value

### 🎨 Modern UI/UX

- **Framer Motion Animations** - Smooth, professional animations throughout
- **Real-time Data Updates** - Polling-based updates for serverless compatibility
- **Mobile Responsive** - Optimized for all screen sizes
- **Dark Theme** - Beautiful dark mode design with gradient accents
- **Animated Background** - Subtle, performant visual effects

---

## 🏗️ Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 14 + React 18 | Server components + client interactivity |
| **Styling** | Tailwind CSS | Utility-first styling |
| **Animations** | Framer Motion | Smooth UI animations |
| **Database** | MongoDB (Mongoose) | Holder cache, payout history, snapshots |
| **Blockchain Data** | Helius RPC + DAS API | Token holders, transaction history |
| **Price Feed** | Jupiter Price API | Real-time token pricing |
| **Token Transfers** | @solana/web3.js + @solana/spl-token | Execute payout transactions |
| **Hosting** | Vercel | Frontend + API + Cron |
| **Validation** | Zod | Runtime type validation |

---

## 💎 How It Works

### The Mechanism

```
┌─────────────────────────────────────────────────────────────────┐
│                    TOPBLAST PAYOUT CYCLE                        │
└─────────────────────────────────────────────────────────────────┘

  1. BUY $TBLAST    →    2. HOLD & WAIT    →    3. AUTOMATIC PAYOUT
       │                       │                        │
       ▼                       ▼                        ▼
  System tracks         Price drops?            Top 3 losers
  your VWAP from        Your drawdown %         receive 80/15/5%
  on-chain buys         increases, you          of the pool
                        climb the board         automatically!
```

### Payout Distribution

| Place | Percentage | Description |
|-------|------------|-------------|
| 🥇 **1st** | 80% | The "Biggest Loser" - highest drawdown percentage |
| 🥈 **2nd** | 15% | Runner up by drawdown |
| 🥉 **3rd** | 5% | Third place by drawdown |

### Eligibility Requirements

| Requirement | Threshold | Purpose |
|-------------|-----------|---------|
| **Minimum Balance** | 100,000 tokens | Prevents dust/micro-wallet attacks |
| **Hold Duration** | ≥ 1 hour | Must hold through at least one cycle |
| **Minimum Loss** | 10% of pool value | Prevents small-loss gaming |
| **Loss Position** | Drawdown < 0% | Must actually be underwater |
| **No Sells** | No sell transactions | Sellers are disqualified |
| **No Transfers Out** | No outgoing transfers | Transferring disqualifies |

### VWAP Calculation

The system calculates your **Volume-Weighted Average Price** from actual on-chain buy transactions:

```
VWAP = Total Cost Basis / Total Tokens Bought

Where:
- Total Cost Basis = Σ(SOL spent × current SOL price) + Σ(stablecoin spent)
- Drawdown % = ((Current Price - VWAP) / VWAP) × 100
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 18+**
- **MongoDB database** (MongoDB Atlas recommended)
- **Helius API key** (free tier available at [helius.dev](https://helius.dev))
- **Solana wallet** with SOL for payouts (optional - only needed for live payouts)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/topblast.git

# Navigate to project directory
cd TopBlast

# Install dependencies
npm install
```

### Environment Setup

1. Copy the example environment file:
```bash
cp env.example.txt .env.local
```

2. Configure your environment variables:

```env
# Required - Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/topblast

# Required - Helius RPC
HELIUS_API_KEY=your_helius_api_key

# Required - Token Configuration
TOKEN_MINT_ADDRESS=your_token_mint_address
TOKEN_DECIMALS=6
TOKEN_SYMBOL=TBLAST

# Pool Configuration
MIN_POOL_SOL=0.025
POOL_BALANCE_USD=500

# Eligibility Thresholds
MIN_TOKEN_HOLDING=100000
MIN_HOLD_DURATION_HOURS=1
MIN_LOSS_THRESHOLD_PCT=10

# Payout Configuration (set to true when ready for live payouts)
EXECUTE_PAYOUTS=false
PAYOUT_WALLET_PRIVATE_KEY=
DEV_WALLET_ADDRESS=

# Security
CRON_SECRET=your_random_secret_here
```

### Development

```bash
# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

---

## 📡 API Reference

### Public Endpoints (Read-Only)

All public endpoints require no authentication. Data is derived from public blockchain state.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/leaderboard` | GET | Current rankings with countdown, pool balance, and eligible holders |
| `/api/leaderboard/history` | GET | Past payout cycles with winners and transaction links |
| `/api/pool` | GET | Reward pool status including balance and payout status |
| `/api/stats` | GET | Protocol statistics (holders, cycles, distributions) |
| `/api/countdown` | GET | Time until next payout |
| `/api/realtime/price` | GET | Current token price and market cap |

### Protected Endpoints

These endpoints require authentication via `CRON_SECRET`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cron/snapshot` | POST | Create holder snapshot (automated) |
| `/api/cron/payout` | POST | Execute payouts (automated) |
| `/api/admin/pool` | POST | Update pool balance (operator) |
| `/api/admin/seed` | POST | Seed initial data (development) |

### Example: Fetch Leaderboard

```bash
curl https://your-domain.com/api/leaderboard
```

Response:
```json
{
  "success": true,
  "data": {
    "status": "ready",
    "cycle": 42,
    "seconds_remaining": 1847,
    "pool_balance_usd": "$547.32",
    "pool_balance_sol": "2.4878",
    "token_price": "$0.00001234",
    "total_holders": 1547,
    "eligible_count": 23,
    "rankings": [
      {
        "rank": 1,
        "wallet": "7xKXt...Fa1",
        "wallet_display": "7xKXt...Fa1",
        "balance": "45,000,000",
        "drawdown_pct": -72.5,
        "loss_usd": "$892.50",
        "is_eligible": true,
        "payout_usd": "$437.86"
      }
    ]
  }
}
```

---

## 📁 Project Structure

```
TopBlast/
├── app/
│   ├── api/
│   │   ├── leaderboard/        # Rankings API
│   │   │   ├── route.ts        # GET current rankings
│   │   │   └── history/        # GET past payouts
│   │   ├── cron/               # Automated jobs
│   │   │   ├── snapshot/       # Hourly snapshot creation
│   │   │   └── payout/         # Hourly payout execution
│   │   ├── pool/               # Pool status
│   │   ├── stats/              # Protocol statistics
│   │   ├── countdown/          # Next payout countdown
│   │   ├── realtime/           # Live price data
│   │   └── admin/              # Operator endpoints
│   ├── leaderboard/            # Leaderboard page
│   │   └── page.tsx
│   ├── history/                # Payout history page
│   │   └── page.tsx
│   ├── stats/                  # Statistics page
│   │   └── page.tsx
│   ├── page.tsx                # Homepage
│   ├── layout.tsx              # Root layout
│   └── globals.css             # Global styles
├── components/
│   └── ui/
│       ├── AnimatedNumber.tsx  # Animated counters & price tickers
│       ├── LiveIndicator.tsx   # Connection status indicator
│       └── Skeleton.tsx        # Loading skeletons
├── hooks/
│   └── useRealtime.ts          # Real-time data hooks
├── lib/
│   ├── config.ts               # Environment configuration
│   ├── db/
│   │   ├── index.ts            # MongoDB connection
│   │   └── models.ts           # Database schemas
│   ├── engine/
│   │   └── calculations.ts     # VWAP, drawdown, ranking logic
│   ├── payout/
│   │   └── executor.ts         # Payout execution & timer
│   ├── solana/
│   │   ├── helius.ts           # Helius RPC integration
│   │   ├── holders.ts          # Holder data utilities
│   │   ├── price.ts            # Price fetching (Jupiter)
│   │   └── transfer.ts         # SOL/SPL token transfers
│   └── tracker/
│       ├── holderService.ts    # Holder management service
│       ├── init.ts             # Service initialization
│       ├── realtime.ts         # Real-time updates
│       └── vwap.ts             # VWAP calculation
├── __tests__/                  # Test files
├── vercel.json                 # Vercel configuration & cron
├── package.json
└── README.md
```

---

## 🔄 Deployment

### Deploy to Vercel

1. Connect your repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy:

```bash
vercel deploy --prod
```

### Cron Jobs

Cron jobs are configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/snapshot",
      "schedule": "0 0 * * *"
    }
  ]
}
```

For custom intervals, the payout executor handles timing internally based on `PAYOUT_INTERVAL_MINUTES`.

---

## 🧪 Testing

### Manual Testing

```bash
# Trigger snapshot manually
curl -X POST http://localhost:3000/api/cron/snapshot

# Trigger payout manually  
curl -X POST http://localhost:3000/api/cron/payout
```

### Unit Tests

The project includes comprehensive tests for:

- VWAP calculation logic
- Drawdown calculations  
- Eligibility checking
- Ranking algorithms
- Payout distribution

```bash
npm test
```

---

## 🔐 Security Considerations

| Area | Implementation |
|------|----------------|
| **Cron Protection** | All cron endpoints protected by `CRON_SECRET` |
| **Read-Only Frontend** | No wallet connection, no user transactions |
| **Input Validation** | Zod schemas for all API inputs |
| **Private Key Security** | Payout wallet key stored in environment only |
| **Rate Limiting** | Helius API rate limits respected with batching |

---

## 🗺️ Roadmap

- [x] Real-time leaderboard with live rankings
- [x] Automated hourly payouts
- [x] VWAP calculation from on-chain data
- [x] Anti-gaming mechanisms
- [x] Full payout history with transaction links
- [ ] Clockwork integration for fully decentralized automation
- [ ] Multi-token support
- [ ] Advanced analytics dashboard
- [ ] Mobile app

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting a PR.

---

## 📞 Support

- **Live App**: [topblasted.fun](https://topblasted.fun)
- **Documentation**: This README and inline code comments
- **Issues**: [GitHub Issues](https://github.com/your-org/topblast/issues)

---

<div align="center">

**Built with 💀 for the degens who HODL through the pain.**

*"When you drawdown, we blast you up."*

</div>
