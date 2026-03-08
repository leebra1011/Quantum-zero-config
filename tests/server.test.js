import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, httpServer, shutdown } from '../server.js';

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
