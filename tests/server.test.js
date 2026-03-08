import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, httpServer, shutdown, tradeHistory } from '../server.js';

beforeAll(() => {
  // Start the server on a random port for testing
  return new Promise(resolve => httpServer.listen(0, resolve));
});

afterAll(() => shutdown());

describe('GET /', () => {
  it('returns the HTML dashboard', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Zero-ETH Trader');
    expect(res.text).toContain('Quantum Bridge');
  });
});

describe('POST /trade', () => {
  it('returns a txHash, toUser and toRelayer on valid request', async () => {
    const res = await request(app)
      .post('/trade')
      .send({ userAddress: '0xSender' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('txHash');
    expect(res.body).toHaveProperty('toUser');
    expect(res.body).toHaveProperty('toRelayer');
    // toUser should be 90% and toRelayer 10% of the profit
    const { toUser, toRelayer } = res.body;
    expect(toUser).toBeGreaterThan(0);
    expect(toRelayer).toBeGreaterThan(0);
    expect(toUser / (toUser + toRelayer)).toBeCloseTo(0.9, 5);
    expect(toRelayer / (toUser + toRelayer)).toBeCloseTo(0.1, 5);
  });

  it('returns 400 when userAddress is missing', async () => {
    const res = await request(app)
      .post('/trade')
      .send({})
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /prices', () => {
  it('returns spread and profit as numbers', async () => {
    const res = await request(app).get('/prices');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('spread');
    expect(res.body).toHaveProperty('profit');
    expect(typeof res.body.spread).toBe('number');
    expect(typeof res.body.profit).toBe('number');
    expect(res.body.spread).toBeGreaterThan(0);
    expect(res.body.profit).toBeGreaterThan(0);
  });
});

describe('GET /history', () => {
  it('returns an array', async () => {
    const res = await request(app).get('/history');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('records a trade after POST /trade and includes it in history', async () => {
    tradeHistory.length = 0; // clear before test
    await request(app)
      .post('/trade')
      .send({ userAddress: '0xHistoryTest' })
      .set('Content-Type', 'application/json');

    const res = await request(app).get('/history');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    const entry = res.body[0];
    expect(entry).toHaveProperty('txHash');
    expect(entry).toHaveProperty('toUser');
    expect(entry).toHaveProperty('toRelayer');
    expect(entry).toHaveProperty('timestamp');
  });

  it('returns newest trades first', async () => {
    tradeHistory.length = 0;
    await request(app).post('/trade').send({ userAddress: '0xA' }).set('Content-Type', 'application/json');
    await request(app).post('/trade').send({ userAddress: '0xB' }).set('Content-Type', 'application/json');

    const res = await request(app).get('/history');
    expect(res.body.length).toBe(2);
    // history is newest-first, so first entry has a timestamp >= second
    expect(new Date(res.body[0].timestamp) >= new Date(res.body[1].timestamp)).toBe(true);
  });
});
