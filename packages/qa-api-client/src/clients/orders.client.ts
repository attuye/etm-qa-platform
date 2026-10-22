import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { HttpClient } from '../http';
import { CreateOrderInput, Order, OrderStatus, orderSchema } from '../schemas';
import { TokenProvider } from './users.client';

export interface CreateOrderOptions {
  idempotencyKey?: string;
}

export interface CreateOrderResult {
  order: Order;
  replayed: boolean;
  idempotencyKey: string;
}

export class OrdersClient {
  constructor(
    private readonly http: HttpClient,
    private readonly getToken: TokenProvider,
  ) {}

  async create(input: CreateOrderInput, options: CreateOrderOptions = {}): Promise<CreateOrderResult> {
    const idempotencyKey = options.idempotencyKey ?? randomUUID();
    const res = await this.http.expect('post', '/orders', {
      token: await this.getToken(),
      headers: { 'Idempotency-Key': idempotencyKey },
      body: input,
      expectedStatus: [201, 200],
      schema: orderSchema,
      schemaName: 'Order',
    });
    return { order: res.data, replayed: res.status === 200, idempotencyKey };
  }

  async list(): Promise<Order[]> {
    const res = await this.http.expect('get', '/orders', {
      token: await this.getToken(),
      expectedStatus: [200],
      schema: z.array(orderSchema),
      schemaName: 'Order[]',
    });
    return res.data;
  }

  async get(id: string): Promise<Order> {
    const res = await this.http.expect('get', `/orders/${id}`, {
      token: await this.getToken(),
      expectedStatus: [200],
      schema: orderSchema,
      schemaName: 'Order',
    });
    return res.data;
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const res = await this.http.expect('patch', `/orders/${id}/status`, {
      token: await this.getToken(),
      body: { status },
      expectedStatus: [200],
      schema: orderSchema,
      schemaName: 'Order',
    });
    return res.data;
  }
}