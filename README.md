# Quantum-zero-config

[![CI](https://github.com/leebra1011/Quantum-zero-config/actions/workflows/ci.yml/badge.svg)](https://github.com/leebra1011/Quantum-zero-config/actions/workflows/ci.yml)

Zero-ETH quantum arbitrage trading demo — a Node.js/Express app that simulates cross-DEX arbitrage trades without requiring ETH for gas fees, using ERC-4337 account abstraction concepts.

## Features

- **Live spread tracking** — polls Uniswap V2 and Binance for real-time ETH prices
- **WebSocket dashboard** — phone-friendly UI pushed via Socket.IO
- **Zero-ETH trade simulation** — signs and hashes a meta-transaction locally, splitting profit 90/10 between user and relayer

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9

## Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/leebra1011/Quantum-zero-config.git
cd Quantum-zero-config

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env if you need a different port

# 4. Start the server
npm start
```

Open <http://localhost:5000> in your browser (or on your phone) to see the live dashboard.

## API

### `POST /trade`

Simulates a zero-ETH arbitrage trade.

**Request body**
```json
{ "userAddress": "0xYourAddress" }
```

**Response**
```json
{
  "txHash": "0x...",
  "toUser": 0.0018,
  "toRelayer": 0.0002
}
```

Returns `400` if `userAddress` is missing.

## Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start the production server |
| `npm test` | Run the test suite (Vitest) |
| `npm run lint` | Lint the source with ESLint |

## Security

Dependencies are kept up-to-date to avoid known vulnerabilities. Run `npm audit` to check the current status.

## License

[MIT](LICENSE)

