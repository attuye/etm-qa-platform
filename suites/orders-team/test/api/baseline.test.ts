import { beforeAll, describe, expect, it } from '@jest/globals';
import { ApiClient, createApiClient } from '@etm/qa-api-client';
import { createCustomer, orderData, userData } from '@etm/qa-data';

describe('Baseline: the raw suite, rewritten with the framework', () => {
  let api: ApiClient;

  beforeAll(() => {
    api = createApiClient();
  });

  it('health check returns ok', async () => {
    const health = await api.health.check();

    expect(health.status).toBe('ok');
  });

  it('registers a new customer with the customer role', async () => {
    const credentials = userData.credentials();

    const user = await api.auth.register(credentials);

    expect(user.role).toBe('customer');
    expect(user.email).toBe(credentials.email);
  });

  it('logs in a registered customer', async () => {
    const credentials = userData.credentials();
    await api.auth.register(credentials);

    const { accessToken } = await api.auth.login(credentials);

    expect(accessToken).toEqual(expect.any(String));
  });

  it('creates an order and calculates the total on the server', async () => {
    const alice = await createCustomer(api);

    const { order, replayed } = await alice.orders.create(
      orderData.valid({ quantity: 2, unitPriceCents: 4500 }),
    );

    expect(replayed).toBe(false);
    expect(order.totalCents).toBe(9000);
    expect(order.status).toBe('pending');
  });

  it('returns the same order when the idempotency key is reused', async () => {
    const alice = await createCustomer(api);
    const input = orderData.valid();
    const first = await alice.orders.create(input);

    const second = await alice.orders.create(input, { idempotencyKey: first.idempotencyKey });

    expect(second.replayed).toBe(true);
    expect(second.order.id).toBe(first.order.id);
  });

  it('does not let another customer see the order', async () => {
    const alice = await createCustomer(api);
    const bob = await createCustomer(api);
    const { order } = await alice.orders.create(orderData.valid());

    await expect(bob.orders.get(order.id)).rejects.toHaveStatus(404);
  });

  it('does not let a customer list users', async () => {
    const alice = await createCustomer(api);

    await expect(alice.users.list()).rejects.toHaveStatus(403);
  });

  it('lets the admin list users', async () => {
    const users = await api.asAdmin().users.list();

    expect(users.length).toBeGreaterThan(0);
  });
});