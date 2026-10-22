import { beforeAll, describe, expect, it } from '@jest/globals';
import { ApiClient, createApiClient, HttpMethod, Session } from '@etm/qa-api-client';
import { createCustomer, orderData, uniqueId } from '@etm/qa-data';

type Role = 'anonymous' | 'customer' | 'admin';

interface EndpointCase {
  name: string;
  method: HttpMethod;
  path: () => string;
  body?: () => object;
  headers?: () => Record<string, string>;
  expected: Record<Role, number>;
}

let api: ApiClient;
let customer: Session;
let orderId: string;

const cases: EndpointCase[] = [
  {
    name: 'GET /users/me',
    method: 'get',
    path: () => '/users/me',
    expected: { anonymous: 401, customer: 200, admin: 200 },
  },
  {
    name: 'GET /users',
    method: 'get',
    path: () => '/users',
    expected: { anonymous: 401, customer: 403, admin: 200 },
  },
  {
    name: 'GET /orders',
    method: 'get',
    path: () => '/orders',
    expected: { anonymous: 401, customer: 200, admin: 200 },
  },
  {
    name: 'POST /orders',
    method: 'post',
    path: () => '/orders',
    body: () => orderData.valid(),
    headers: () => ({ 'Idempotency-Key': uniqueId('key') }),
    expected: { anonymous: 401, customer: 201, admin: 403 },
  },
  {
    name: 'PATCH /orders/:id/status',
    method: 'patch',
    path: () => `/orders/${orderId}/status`,
    body: () => ({ status: 'cancelled' }),
    expected: { anonymous: 401, customer: 403, admin: 200 },
  },
];

const roles: Role[] = ['anonymous', 'customer', 'admin'];

async function tokenFor(role: Role): Promise<string | undefined> {
  if (role === 'anonymous') {
    return undefined;
  }
  return role === 'admin' ? api.asAdmin().getToken() : customer.getToken();
}

beforeAll(async () => {
  api = createApiClient();
  customer = await createCustomer(api);
  orderId = (await customer.orders.create(orderData.valid())).order.id;
});

describe.each(cases)('$name', (endpoint) => {
  it.each(roles)('as %s', async (role) => {
    const res = await api.raw(endpoint.method, endpoint.path(), {
      token: await tokenFor(role),
      body: endpoint.body?.(),
      headers: endpoint.headers?.(),
    });

    expect(res).toHaveStatus(endpoint.expected[role]);
  });
});