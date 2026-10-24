import { beforeAll, describe, expect, it } from '@jest/globals';
import { ApiClient, createApiClient, OrderStatus, Session } from '@etm/qa-api-client';
import { createCustomer, orderData } from '@etm/qa-data';
import { randomUUID } from 'node:crypto';
import { createOrderInStatus } from '../../support/orders';

const STATUSES: OrderStatus[] = ['pending', 'confirmed', 'shipped', 'cancelled'];

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: [],
  cancelled: [],
};

const transitions = STATUSES.flatMap((from) =>
  STATUSES.map((to) => ({ from, to, expected: ALLOWED[from].includes(to) ? 200 : 409 })),
);

describe('PATCH /orders/:id/status: the order state machine', () => {
  let api: ApiClient;
  let customer: Session;

  beforeAll(async () => {
    api = createApiClient();
    customer = await createCustomer(api);
  });

  it.each(transitions)('$from -> $to returns $expected', async ({ from, to, expected }) => {
    const orderId = await createOrderInStatus(api, customer, from);

    const res = await api.raw('patch', `/orders/${orderId}/status`, {
      token: await api.asAdmin().getToken(),
      body: { status: to },
    });

    expect(res).toHaveStatus(expected);
    const current = await api.asAdmin().orders.get(orderId);
    expect(current.status).toBe(expected === 200 ? to : from);
  });

  it('rejects an unknown status value', async () => {
    const { order } = await customer.orders.create(orderData.valid());

    const res = await api.raw('patch', `/orders/${order.id}/status`, {
      token: await api.asAdmin().getToken(),
      body: { status: 'delivered' },
    });

    expect(res).toHaveStatus(400);
  });

  it('returns 404 for an order that does not exist', async () => {
    await expect(api.asAdmin().orders.updateStatus(randomUUID(), 'confirmed')).rejects.toHaveStatus(404);
  });

  it('returns 400 for an id that is not a UUID', async () => {
    const res = await api.raw('patch', '/orders/123/status', {
      token: await api.asAdmin().getToken(),
      body: { status: 'confirmed' },
    });

    expect(res).toHaveStatus(400);
  });
});