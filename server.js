import 'dotenv/config';
import express from 'express';
import { Server } from 'socket.io';
import cors from 'cors';
import { createServer } from 'http';
import fetch from 'node-fetch';
import { Wallet, parseEther, keccak256 } from 'ethers';

export const app = express();
export const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Demo data for rapid on-phone testing (updated by fetchPrices)
export let demoSpread = 0.004;
export let demoProfit = 0.002;

let priceTimer = null;

// live data stub – fetches real prices from Uniswap V2 and Binance
export const fetchPrices = async () => {
  try {
    const uni = await fetch('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', {
      method: 'POST',
      body: JSON.stringify({ query: '{ pairs(first: 1, where:{ token0: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"}) { token0Price } }' }),
      headers: { 'Content-Type': 'application/json' }
    });
    const uniData = await uni.json();
    const uniPrice = parseFloat(uniData.data.pairs[0]?.token0Price);
    const bin = await fetch('https://api.binance.com/api/v3/ticker/bookTicker?symbol=ETHUSDT');
    const binData = await bin.json();
    const binMid = (parseFloat(binData.bidPrice) + parseFloat(binData.askPrice)) / 2;
    demoSpread = Math.max(0.001, binMid - uniPrice);
    demoProfit = Math.max(0.001, demoSpread - 0.0002); // super-simple gas estimate
  } catch (_e) { /* retain previous values on network error */ }
  priceTimer = setTimeout(fetchPrices, 5000);
};

// ---------- websocket push ----------
const liveInterval = setInterval(() => {
  io.emit('live', {
    spread: demoSpread.toFixed(4),
    profit: demoProfit.toFixed(4)
  });
}, 1000);

// ---------- zero-ETH metatx ----------
// ERC-4337 EntryPoint (unused in simulation but kept for reference)
// const EP = '0x5FF137D4b0FDcd49dCa30c7CF57E578a026d2789';
const relayerWallet = Wallet.createRandom();
console.log('Relayer address:', relayerWallet.address);

app.post('/trade', async (req, res) => {
  const { userAddress } = req.body;
  if (!userAddress) {
    return res.status(400).json({ error: 'userAddress is required' });
  }
  const profit = demoProfit;
  const toUser = profit * 0.9;
  const toRelayer = profit * 0.1;
  const tx = {
    to: relayerWallet.address,
    value: parseEther(profit.toString()),
    chainId: 1,
    nonce: 0,
    gasLimit: 21000,
    gasPrice: 0
  };
  const signed = await relayerWallet.signTransaction(tx);
  return res.json({ txHash: keccak256(signed), toUser, toRelayer });
});

// ---------- serve phone dashboard ----------
app.get('/', (_req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width" /><title>Zero-ETH Trader</title>
    <style>body{background:#111;color:#0f0;font-family:sans-serif;text-align:center}
    button{background:#0f0;border:none;padding:1em 2em;font-size:1.5em;margin-top:2em}
    h1{font-size:2em}</style></head>
    <body>
      <h1>Quantum Bridge <span id="spread">...</span></h1>
      <p>Profit split 90 / 10 &rarr; you earn first</p>
      <button id="exe">Execute Trade (0 ETH)</button>
      <p id="hash"></p>
      <script src="/socket.io/socket.io.js"></script>
      <script>
        const socket = io();
        socket.on('live', d => { document.getElementById('spread').innerText = d.profit; });
        document.getElementById('exe').onclick = async () => {
          const r = await fetch('/trade', { method: 'POST', body: JSON.stringify({ userAddress: '0xSender' }), headers:{'Content-Type':'application/json'} });
          const j = await r.json();
          alert('Trade simulated! Your share: ' + j.toUser + ' ETH');
          document.getElementById('hash').innerText = 'Sim hash: ' + j.txHash;
        };
      </script>
    </body></html>`);
});

// Graceful shutdown helper (used in tests)
export function shutdown() {
  clearInterval(liveInterval);
  if (priceTimer) clearTimeout(priceTimer);
  return new Promise(resolve => httpServer.close(resolve));
}

const PORT = process.env.PORT || 5000;

// Only start listening when run directly (not imported by tests)
if (process.env.NODE_ENV !== 'test') {
  fetchPrices();
  httpServer.listen(PORT, () => console.log(`\uD83D\uDE80 Zero-ETH trading live on http://localhost:${PORT}`));
}

