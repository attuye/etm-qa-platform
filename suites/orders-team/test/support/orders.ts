import type { ApiClient, OrderStatus, RawResponse, Session } from '@etm/qa-api-client';
import { orderData, uniqueId } from '@etm/qa-data';

export async function postOrder(
  api: ApiClient,
  session: Session,
  body: object,
  idempotencyKey: string | null = uniqueId('key'),
): Promise<RawResponse> {
  return api.raw('post', '/orders', {
    token: await session.getToken(),
    body,
    headers: idempotencyKey === null ? {} : { 'Idempotency-Key': idempotencyKey },
  });
}

const PATH_TO: Record<OrderStatus, OrderStatus[]> = {
  pending: [],
  confirmed: ['confirmed'],
  shipped: ['confirmed', 'shipped'],
  cancelled: ['cancelled'],
};

export async function createOrderInStatus(
  api: ApiClient,
  customer: Session,
  status: OrderStatus,
): Promise<string> {
  const { order } = await customer.orders.create(orderData.valid());
  for (const step of PATH_TO[status]) {
    await api.asAdmin().orders.updateStatus(order.id, step);
  }
  return order.id;
}