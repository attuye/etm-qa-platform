import { beforeAll, describe, expect, it } from '@jest/globals';
import { ApiClient, createApiClient, orderSchema } from '@etm/qa-api-client';
import { createCustomer, orderData, uniqueId } from '@etm/qa-data';
import { postOrder } from '../../support/orders';

describe('Idempotent order creation', () => {
  let api: ApiClient;

  beforeAll(() => {
    api = createApiClient();
  });

  it('marks a replayed response with the Idempotent-Replayed header', async () => {
    const alice = await createCustomer(api);
    const key = uniqueId('key');
    const body = orderData.valid();

    const first = await postOrder(api, alice, body, key);
    const second = await postOrder(api, alice, body, key);

    expect(first).toHaveStatus(201);
    expect(second).toHaveStatus(200);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(orderSchema.parse(second.body).id).toBe(orderSchema.parse(first.body).id);
  });

  it('rejects the same key with a different body and creates nothing new', async () => {
    const alice = await createCustomer(api);
    const first = await alice.orders.create(orderData.valid({ quantity: 1 }));

    const conflicting = await postOrder(
      api,
      alice,
      orderData.valid({ quantity: 2 }),
      first.idempotencyKey,
    );

    expect(conflicting).toHaveStatus(422);
    expect(await alice.orders.list()).toHaveLength(1);
  });

  it('scopes keys to the customer, so two customers can use the same key', async () => {
    const alice = await createCustomer(api);
    const bob = await createCustomer(api);
    const sharedKey = uniqueId('key');

    const forAlice = await alice.orders.create(orderData.valid(), { idempotencyKey: sharedKey });
    const forBob = await bob.orders.create(orderData.valid(), { idempotencyKey: sharedKey });

    expect(forAlice.replayed).toBe(false);
    expect(forBob.replayed).toBe(false);
    expect(forBob.order.id).not.toBe(forAlice.order.id);
  });

  it('creates exactly one order when identical requests arrive at the same time', async () => {
    const alice = await createCustomer(api);
    const key = uniqueId('key');
    const body = orderData.valid();
    await alice.getToken();

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => postOrder(api, alice, body, key)),
    );

    const statuses = responses.map((res) => res.status).sort();
    expect(statuses).toEqual([200, 200, 200, 200, 201]);

    const ids = new Set(responses.map((res) => orderSchema.parse(res.body).id));
    expect(ids.size).toBe(1);
    expect(await alice.orders.list()).toHaveLength(1);
  });
});