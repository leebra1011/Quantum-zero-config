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

// Ring buffer of the last 20 simulated trades
const HISTORY_MAX = 20;
export const tradeHistory = [];

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
  } catch { /* retain previous values on network error */ }
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
  const txHash = keccak256(signed);
  const entry = { txHash, toUser, toRelayer, timestamp: new Date().toISOString() };
  tradeHistory.push(entry);
  if (tradeHistory.length > HISTORY_MAX) tradeHistory.shift();
  return res.json({ txHash, toUser, toRelayer });
});

// ---------- prices API ----------
app.get('/prices', (_req, res) => {
  res.json({ spread: demoSpread, profit: demoProfit });
});

// ---------- trade history API ----------
app.get('/history', (_req, res) => {
  res.json(tradeHistory.slice().reverse());
});

// ---------- serve phone dashboard ----------
app.get('/', (_req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width" /><title>Zero-ETH Trader</title>
    <style>body{background:#111;color:#0f0;font-family:sans-serif;text-align:center}
    button{background:#0f0;border:none;padding:1em 2em;font-size:1.5em;margin-top:2em}
    h1{font-size:2em}
    #history{margin-top:2em;text-align:left;max-width:480px;display:inline-block}
    #history h2{font-size:1.1em;border-bottom:1px solid #0f0;padding-bottom:.3em}
    #history ul{list-style:none;padding:0;margin:0;font-size:.8em}
    #history li{padding:.3em 0;border-bottom:1px solid #1a1a1a;word-break:break-all}</style></head>
    <body>
      <h1>Quantum Bridge <span id="spread">...</span></h1>
      <p>Profit split 90 / 10 &rarr; you earn first</p>
      <button id="exe">Execute Trade (0 ETH)</button>
      <p id="hash"></p>
      <div id="history"><h2>Recent Trades</h2><ul id="trades"><li>No trades yet</li></ul></div>
      <script src="/socket.io/socket.io.js"></script>
      <script>
        const socket = io();
        socket.on('live', d => {
          document.getElementById('spread').innerText = 'spread ' + d.spread + ' | profit ' + d.profit;
        });
        function loadHistory() {
          fetch('/history').then(r => r.json()).then(trades => {
            const ul = document.getElementById('trades');
            if (!trades.length) { ul.innerHTML = '<li>No trades yet</li>'; return; }
            ul.innerHTML = trades.map(t =>
              '<li>' + t.timestamp.replace('T',' ').slice(0,19) +
              ' &rarr; +' + t.toUser.toFixed(6) + ' ETH | hash: ' + t.txHash.slice(0,12) + '…</li>'
            ).join('');
          });
        }
        loadHistory();
        document.getElementById('exe').onclick = async () => {
          const r = await fetch('/trade', { method: 'POST', body: JSON.stringify({ userAddress: '0xSender' }), headers:{'Content-Type':'application/json'} });
          const j = await r.json();
          alert('Trade simulated! Your share: ' + j.toUser + ' ETH');
          document.getElementById('hash').innerText = 'Sim hash: ' + j.txHash;
          loadHistory();
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
  httpServer.listen(PORT, '0.0.0.0', () => console.log(`\uD83D\uDE80 Zero-ETH trading live on http://localhost:${PORT}`));
}

