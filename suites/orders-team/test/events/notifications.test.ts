import { beforeAll, describe, expect, it } from '@jest/globals';
import { ApiClient, createApiClient } from '@etm/qa-api-client';
import { createCustomer, orderData } from '@etm/qa-data';
import { describeIfEvents } from '../support/events';
import { holdsFor, waitFor } from '../support/wait-for';

describe('Notification endpoints: access control', () => {
  let api: ApiClient;

  beforeAll(() => {
    api = createApiClient();
  });

  it('requires a token to list notifications', async () => {
    const res = await api.raw('get', '/notifications');

    expect(res).toHaveStatus(401);
  });

  it('does not let a customer see parked events', async () => {
    const customer = await createCustomer(api);

    await expect(customer.eventFailures.list()).rejects.toHaveStatus(403);
  });
});

describeIfEvents('Order notifications (black-box: public API only)', () => {
  let api: ApiClient;

  beforeAll(() => {
    api = createApiClient();
  });

  it('creates one notification for a new order', async () => {
    const customer = await createCustomer(api);
    const { order } = await customer.orders.create(
      orderData.valid({ product: 'Event lamp', quantity: 2, unitPriceCents: 1999 }),
    );

    const notifications = await waitFor(
      () => customer.notifications.list(),
      (list) => list.length > 0,
      { description: `a notification for order ${order.id}` },
    );

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      orderId: order.id,
      customerId: order.customerId,
      message: 'Order received: 2 x Event lamp, total $39.98',
    });
  });

  it('does not notify again when an order request is replayed', async () => {
    const customer = await createCustomer(api);
    const input = orderData.valid();
    const first = await customer.orders.create(input);

    const replay = await customer.orders.create(input, { idempotencyKey: first.idempotencyKey });
    expect(replay.replayed).toBe(true);

    await waitFor(() => customer.notifications.list(), (list) => list.length >= 1, {
      description: 'the first notification',
    });
    await holdsFor(() => customer.notifications.list(), (list) => list.length === 1, {
      description: 'exactly one notification',
    });
  });

  it('shows a customer only their own notifications', async () => {
    const alice = await createCustomer(api);
    const bob = await createCustomer(api);
    await alice.orders.create(orderData.valid());

    await waitFor(() => alice.notifications.list(), (list) => list.length === 1, {
      description: "Alice's notification",
    });

    expect(await bob.notifications.list()).toEqual([]);
  });

  it('keeps the invariant: every order has exactly one notification', async () => {
    const customer = await createCustomer(api);
    const created = await Promise.all(
      Array.from({ length: 5 }, () => customer.orders.create(orderData.valid())),
    );
    const orderIds = created.map(({ order }) => order.id).sort();

    const notifications = await waitFor(
      () => customer.notifications.list(),
      (list) => list.length >= orderIds.length,
      { description: `${orderIds.length} notifications` },
    );

    expect(notifications.map((n) => n.orderId).sort()).toEqual(orderIds);
  });
});