import { describe, expect, it } from '@jest/globals';
import request from 'supertest';

const API = 'http://localhost:3001/api';

describe('Orders API (raw, no framework)', () => {
  let customerToken: string;
  let orderId: string;

  it('health check returns ok', async () => {
    const res = await request(API).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('registers a new customer', async () => {
    const res = await request(API)
      .post('/auth/register')
      .send({ email: 'raw-customer@example.com', password: 'Passw0rd!' });
    console.log('Register response:', res.body);
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('customer');
  });

  it('logs in the customer', async () => {
    const res = await request(API)
      .post('/auth/login')
      .send({ email: 'raw-customer@example.com', password: 'Passw0rd!' });

    console.log('Login response:', res.body);
    expect(res.status).toBe(200);
    customerToken = res.body.accessToken;
  });

  it('creates an order', async () => {
    const res = await request(API)
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', 'raw-key-1')
      .send({ product: 'Laptop stand', quantity: 2, unitPriceCents: 4500 });

    console.log('Order response:', res.body);
    console.log('Customer token:', customerToken)
    expect(res.status).toBe(201);
    expect(res.body.totalCents).toBe(9000);
    orderId = res.body.id;
  });

  it('returns the same order when the idempotency key is reused', async () => {
    const res = await request(API)
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', 'raw-key-1')
      .send({ product: 'Laptop stand', quantity: 2, unitPriceCents: 4500 });
    console.log('Idempotent order response:', res.body);
    console.log('Idempotent order Id:', res.body.id);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(orderId);
  });

  it('does not let another customer see the order', async () => {
    await request(API)
      .post('/auth/register')
      .send({ email: 'raw-other@example.com', password: 'Passw0rd!' });

    const login = await request(API)
      .post('/auth/login')
      .send({ email: 'raw-other@example.com', password: 'Passw0rd!' });
    const otherToken = login.body.accessToken;
    console.log('other access token is:', otherToken)

    const res = await request(API)
      .get(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });

  it('does not let a customer list users', async () => {
    const res = await request(API)
      .get('/users')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });

  it('lets the admin list users', async () => {
    const login = await request(API)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'Admin123!Local' });
    const adminToken = login.body.accessToken;

    const res = await request(API)
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});