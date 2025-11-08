# Wallet Tracker - Multi-chain Backend (Starter)

This starter backend implements watchers for multiple chains:
- Ethereum (Alchemy WebSocket) - detects pending + confirmed
- BSC (BSC WS or RPC polling) - pending via WS or polling
- Bitcoin (Blockstream REST polling) - confirmed/pending via address tx list
- TRON (TronGrid REST polling) - TRC20 incoming transactions
- Solana (solana/web3.js polling) - recent signatures

## Quickstart

1. Copy `backend/.env.example` to `backend/.env` and fill the required API keys and wallet addresses.
2. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
3. Start the app:
   ```bash
   npm start
   ```
4. (Optional) Connect a web client to Socket.IO at `http://localhost:5000` and listen for `newTransaction` events.

## Notes & Caveats
- This is a **starter** scaffold. For production:
  - Use robust providers and managed WebSocket endpoints (Alchemy, QuickNode).
  - Prefer provider webhooks where available (BlockCypher, TronGrid, Helius) to avoid polling.
  - Add persistence (MongoDB/Postgres) to record transaction history.
  - Add authentication and secure storage for API keys.
