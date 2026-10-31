import { randomUUID } from 'node:crypto';
import { ObjectLiteral, QueryFailedError, Repository } from 'typeorm';
import { EventFailure } from '../events/event-failure.entity';
import { Notification } from '../events/notification.entity';
import { OrderStatus } from '../orders/order-status.enum';
import { Order } from '../orders/order.entity';

/** The error Postgres gives for a duplicate value in a unique column (code 23505). */
export function uniqueViolation(): QueryFailedError {
  const driverError = Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: '23505',
  });
  return new QueryFailedError('INSERT ...', [], driverError);
}

/** Lets a small fake stand in where the code expects a full TypeORM repository. */
export function asRepository<T extends ObjectLiteral>(fake: object): Repository<T> {
  return fake as unknown as Repository<T>;
}

export function fakeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: randomUUID(),
    customerId: randomUUID(),
    idempotencyKey: `key-${randomUUID()}`,
    product: 'Desk lamp',
    quantity: 2,
    unitPriceCents: 1999,
    totalCents: 3998,
    status: OrderStatus.Pending,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Order;
}

export class FakeOrderRepository {
  readonly rows = new Map<string, Order>();
  failWith?: Error;

  add(order: Order): Order {
    this.rows.set(order.id, order);
    return order;
  }

  async findOne({ where }: { where: { id: string } }): Promise<Order | null> {
    if (this.failWith) {
      throw this.failWith;
    }
    return this.rows.get(where.id) ?? null;
  }
}

type NewNotification = Pick<Notification, 'eventId' | 'customerId' | 'orderId' | 'message'>;

export class FakeNotificationRepository {
  readonly rows: NewNotification[] = [];

  async insert(row: NewNotification): Promise<void> {
    if (this.rows.some((existing) => existing.eventId === row.eventId)) {
      throw uniqueViolation(); // behaves like the unique index on eventId
    }
    this.rows.push(row);
  }
}

export class FakeEventFailureRepository {
  readonly rows = new Map<string, Partial<EventFailure>>();
  failWith?: Error;

  async findOne({ where }: { where: { eventKey: string } }): Promise<EventFailure | null> {
    if (this.failWith) {
      throw this.failWith;
    }
    return (this.rows.get(where.eventKey) as EventFailure | undefined) ?? null;
  }

  async save(row: Partial<EventFailure>): Promise<Partial<EventFailure>> {
    if (this.failWith) {
      throw this.failWith;
    }
    this.rows.set(String(row.eventKey), { ...row });
    return row;
  }

  async delete({ eventKey }: { eventKey: string }): Promise<void> {
    this.rows.delete(eventKey);
  }
}