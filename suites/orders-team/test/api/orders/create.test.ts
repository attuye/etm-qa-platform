import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { ApiClient, createApiClient, Session } from '@etm/qa-api-client';
import { createCustomer, ORDER_LIMITS, orderData } from '@etm/qa-data';
import { postOrder } from '../../support/orders';

describe('POST /orders: creating an order', () => {
  let api: ApiClient;
  let alice: Session;

  beforeAll(async () => {
    api = createApiClient();
    alice = await createCustomer(api);
  });

  it('belongs to the caller and starts as pending', async () => {
    const me = await alice.users.me();

    const { order } = await alice.orders.create(orderData.valid());

    expect(order.customerId).toBe(me.id);
    expect(order.status).toBe('pending');
  });

  describe('quantity', () => {
    it.each([
      { quantity: ORDER_LIMITS.minQuantity - 1, status: 400 },
      { quantity: ORDER_LIMITS.minQuantity, status: 201 },
      { quantity: ORDER_LIMITS.maxQuantity, status: 201 },
      { quantity: ORDER_LIMITS.maxQuantity + 1, status: 400 },
    ])('$quantity returns $status', async ({ quantity, status }) => {
      const res = await postOrder(api, alice, orderData.valid({ quantity }));

      expect(res).toHaveStatus(status);
    });

    it.each([2.5, '2', -1, null])('rejects the non-integer or negative value %j', async (quantity) => {
      const res = await postOrder(api, alice, { ...orderData.valid(), quantity });

      expect(res).toHaveStatus(400);
    });
  });

  describe('unit price', () => {
    it.each([
      { unitPriceCents: 0, status: 400 },
      { unitPriceCents: 1, status: 201 },
      { unitPriceCents: 9.99, status: 400 },
    ])('$unitPriceCents cents returns $status', async ({ unitPriceCents, status }) => {
      const res = await postOrder(api, alice, { ...orderData.valid(), unitPriceCents });

      expect(res).toHaveStatus(status);
    });
  });

  describe('product name', () => {
    it.each([
      { label: 'empty', product: '', status: 400 },
      { label: 'at the maximum length', product: 'a'.repeat(ORDER_LIMITS.maxProductLength), status: 201 },
      { label: 'over the maximum length', product: 'a'.repeat(ORDER_LIMITS.maxProductLength + 1), status: 400 },
    ])('$label returns $status', async ({ product, status }) => {
      const res = await postOrder(api, alice, orderData.valid({ product }));

      expect(res).toHaveStatus(status);
    });

    it.failing('KNOWN BUG: rejects a name made only of spaces', async () => {
      const res = await postOrder(api, alice, orderData.valid({ product: '     ' }));

      expect(res).toHaveStatus(400);
    });
  });

  it.failing('KNOWN BUG: rejects an order whose total does not fit in the database', async () => {
    const res = await postOrder(
      api,
      alice,
      orderData.valid({ quantity: ORDER_LIMITS.maxQuantity, unitPriceCents: 2_147_484 }),
    );

    expect(res).toHaveStatus(400);
  });

  it.each([
    { field: 'totalCents', value: 1 },
    { field: 'status', value: 'shipped' },
    { field: 'customerId', value: randomUUID() },
  ])('rejects a client-supplied $field', async ({ field, value }) => {
    const res = await postOrder(api, alice, { ...orderData.valid(), [field]: value });

    expect(res).toHaveStatus(400);
  });

  describe('Idempotency-Key header', () => {
    it.each([
      { label: 'missing', key: null, status: 400 },
      { label: 'blank', key: '   ', status: 400 },
      { label: '100 characters', key: 'k'.repeat(100), status: 201 },
      { label: '101 characters', key: 'k'.repeat(101), status: 400 },
    ])('$label returns $status', async ({ key, status }) => {
      const uniqueKey = key && key.trim() ? `${randomUUID()}${key}`.slice(0, key.length) : key;

      const res = await postOrder(api, alice, orderData.valid(), uniqueKey);

      expect(res).toHaveStatus(status);
    });
  });
});