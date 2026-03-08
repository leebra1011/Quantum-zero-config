# Copilot Instructions

## Project Overview

**Quantum-zero-config** is a Node.js/Express application that simulates zero-ETH cross-DEX arbitrage trading using ERC-4337 account abstraction concepts. It polls Uniswap V2 and Binance for live ETH prices, pushes spread/profit data to a phone-friendly dashboard via Socket.IO, and signs meta-transactions locally without requiring ETH for gas.

## Tech Stack

- **Runtime**: Node.js ≥ 18 (ES modules, `"type": "module"`)
- **Framework**: Express 4
- **WebSockets**: Socket.IO 4
- **Blockchain**: ethers v6 (wallet signing, `parseEther`, `keccak256`)
- **HTTP client**: node-fetch 3
- **Config**: dotenv
- **Testing**: Vitest + Supertest
- **Linting**: ESLint 9 (flat config via `eslint.config.js`)

## Repository Layout

```
server.js          # Main application (Express + Socket.IO server)
tests/
  server.test.js   # Vitest + Supertest integration tests
eslint.config.js   # ESLint flat config
vitest.config.js   # Vitest configuration
.env.example       # Environment variable template
package.json
```

## Development Workflow

### Install dependencies
```bash
npm install
```

### Run the server locally
```bash
npm start          # starts on PORT (default 5000)
```

### Run tests
```bash
npm test           # vitest run (non-watch)
```

Always run `npm test` after making changes to verify nothing is broken.

### Lint
```bash
npm run lint       # eslint .
```

Run `npm run lint` after making changes and fix any reported issues before committing.

## Coding Conventions

- Use ES module syntax (`import`/`export`) throughout — the project is `"type": "module"`.
- Keep all server logic in `server.js`; export `app`, `httpServer`, `shutdown`, and any shared state needed by tests.
- Environment variables are loaded via `dotenv/config`; add new variables to `.env.example` with a comment explaining their purpose.
- Do **not** start the HTTP server or call `fetchPrices()` when `process.env.NODE_ENV === 'test'` — the test suite starts the server manually on a random port.
- Avoid committing `.env`; it is already listed in `.gitignore`.

## Testing Guidelines

- Tests live in `tests/server.test.js` and use Vitest + Supertest.
- Each test file imports `{ app, httpServer, shutdown }` from `../server.js`.
- Use `beforeAll` to start `httpServer` on port `0` (random) and `afterAll` to call `shutdown()`.
- Prefer integration tests over unit tests for Express routes.
- Aim to keep test coverage for all public API endpoints (`GET /`, `POST /trade`).

## Security Notes

- Run `npm audit` before opening a PR to check for known vulnerabilities in dependencies.
- Never commit private keys or secrets; the relayer wallet is ephemeral (`Wallet.createRandom()`).
- Keep dependencies up-to-date to avoid known CVEs.
