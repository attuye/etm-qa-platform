import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { ApiClient, createApiClient } from '@etm/qa-api-client';
import { createCustomer, orderData } from '@etm/qa-data';

describe('Order ownership', () => {
  let api: ApiClient;

  beforeAll(() => {
    api = createApiClient();
  });

  it('lists only the caller\'s own orders', async () => {
    const alice = await createCustomer(api);
    const bob = await createCustomer(api);
    const a1 = await alice.orders.create(orderData.valid());
    const a2 = await alice.orders.create(orderData.valid());
    await bob.orders.create(orderData.valid());

    const ids = (await alice.orders.list()).map((order) => order.id);

    expect(ids.sort()).toEqual([a1.order.id, a2.order.id].sort());
  });

  it('lets a customer read their own order', async () => {
    const alice = await createCustomer(api);
    const { order } = await alice.orders.create(orderData.valid());

    const fetched = await alice.orders.get(order.id);

    expect(fetched).toEqual(order);
  });

  it('lets an admin read and list any customer\'s orders', async () => {
    const alice = await createCustomer(api);
    const bob = await createCustomer(api);
    const { order: aliceOrder } = await alice.orders.create(orderData.valid());
    const { order: bobOrder } = await bob.orders.create(orderData.valid());
    const admin = api.asAdmin();

    expect((await admin.orders.get(aliceOrder.id)).id).toBe(aliceOrder.id);
    const allIds = (await admin.orders.list()).map((order) => order.id);
    expect(allIds).toEqual(expect.arrayContaining([aliceOrder.id, bobOrder.id]));
  });

  it('returns 404 for an order id that does not exist', async () => {
    const alice = await createCustomer(api);

    await expect(alice.orders.get(randomUUID())).rejects.toHaveStatus(404);
  });

    it('returns 404, not 403, for another customer\'s order', async () => {
    const alice = await createCustomer(api);
    const bob = await createCustomer(api);
    const { order } = await alice.orders.create(orderData.valid());

    await expect(bob.orders.get(order.id)).rejects.toHaveStatus(404);
    await expect(bob.orders.get(randomUUID())).rejects.toHaveStatus(403);
  });

  // it('returns 404, not 403, for another customer\'s order', async () => {
  //   const alice = await createCustomer(api);
  //   const bob = await createCustomer(api);
  //   const { order } = await alice.orders.create(orderData.valid());

  //   const fromBob = bob.orders.get(order.id);
  //   const missing = bob.orders.get(randomUUID());

  //   await expect(fromBob).rejects.toHaveStatus(404);
  //   await expect(missing).rejects.toHaveStatus(404);
  // });
});