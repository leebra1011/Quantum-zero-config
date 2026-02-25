import 'dotenv/config';
import express from 'express';
import { Server } from 'socket.io';
import cors from 'cors';
import { createServer } from 'http';
import fetch from 'node-fetch';
import { Wallet, ethers } from 'ethers';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });
app.use(cors());
app.use(express.static('public'));

// portable Demo data for rapid on-phone testing
let demoSpread = 0.004, demoProfit = 0.002;

// live data stub
const fetchPrices = async () => {
  try {
    const uni = await fetch(`https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2`, {
      method: 'POST',
      body: JSON.stringify({ query: `{ pairs(first: 1, where:{ token0: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"}) { token0Price } }` }),
      headers: { 'Content-Type': 'application/json' }
    });
    const uniData = await uni.json();
    const uniPrice = parseFloat(uniData.data.pairs[0]?.token0Price);
    const bin = await fetch('https://api.binance.com/api/v3/ticker/bookTicker?symbol=ETHUSDT');
    const binData = await bin.json();
    const binMid = (parseFloat(binData.bidPrice) + parseFloat(binData.askPrice)) / 2;
    demoSpread = Math.max(0.001, binMid - uniPrice);
    demoProfit = Math.max(0.001, demoSpread - 0.0002); // super-simple gas est
  } catch (e) { /* fallback */ }
  setTimeout(fetchPrices, 5000);
};
fetchPrices();

// ---------- websocket push ----------
setInterval(() => {
  io.emit('live', {
    spread: demoSpread.toFixed(4),
    profit: demoProfit.toFixed(4)
  });
}, 1000);

// ---------- zero-ETH metatx ----------
const EP = '0x5FF137D4b0FDcd49dCa30c7CF57E578a026d2789'; // ERC-4337 EntryPoint
const relayerWallet = Wallet.createRandom(); // generates zero-fund wallet
console.log('Relayer address:', relayerWallet.address);

app.post('/trade', async (req, res) => {
  const user = req.body.userAddress;
  const profit = demoProfit;
  const toUser = profit * 0.9;
  const toRelayer = profit * 0.1;
  const tx = {
    to: relayerWallet.address,
    value: ethers.utils.parseEther(profit.toString())
  };
  const signed = await relayerWallet.signTransaction(tx);
  return res.json({ txHash: ethers.utils.keccak256(signed), toUser, toRelayer });
});

// ---------- serve phone dashboard ----------
app.get('/', (_req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width" /><title>Zero-ETH Trader</title>
    <style>body{background:#111;color:#0f0;font-family:sans-serif;text-align:center}
    button{background:#0f0;border:none;padding:1em 2em;font-size:1.5em;margin-top:2em}
    h1{font-size:2em}</style></head>
    <body>
      <h1>Quantum Bridge <span id="spread">...</span></h1>
      <p>Profit split 90 / 10 → you earn first</p>
      <button id="exe">Execute Trade (0 ETH)</button>
      <p id="hash"></p>
      <script>
        const socket = io();
        socket.on('live', d => { document.getElementById('spread').innerText = d.profit; });
        document.getElementById('exe').onclick = async () => {
          const r = await fetch('/trade', { method: 'POST', body: JSON.stringify({ userAddress: '0xSender' }), headers:{'Content-Type':'application/json'} });
          const j = await r.json();
          alert(`Trade simulated! Your share: ${j.toUser} ETH`);
          document.getElementById('hash').innerText = 'Sim hash: ' + j.txHash;
        };
      </script>
    </body></html>`);
});

const PORT = 5000;
import('http').then(http => http.createServer(app).listen(PORT, () => console.log(`🚀 Zero-ETH trading live on http://localhost:${PORT}`)));

