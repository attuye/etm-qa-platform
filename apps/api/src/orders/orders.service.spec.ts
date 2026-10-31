import { randomUUID } from 'node:crypto';
import { describe, expect, it, jest } from '@jest/globals';
import { OrderEventsPublisher } from '../events/order-events.publisher';
import { asRepository, fakeOrder, uniqueViolation } from '../testing/fakes';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from './order-status.enum';
import { Order } from './order.entity';
import { OrdersService } from './orders.service';

class FakeOrderStore {
  readonly rows: Order[] = [];
  /** Simulates another request with the same key saving first. */
  raceWinner?: Order;

  async findOne({ where }: { where: Partial<Order> }): Promise<Order | null> {
    return (
      this.rows.find(
        (o) => o.customerId === where.customerId && o.idempotencyKey === where.idempotencyKey,
      ) ?? null
    );
  }

  create(data: Partial<Order>): Order {
    return { ...data } as Order;
  }

  async save(order: Order): Promise<Order> {
    if (this.raceWinner) {
      this.rows.push(this.raceWinner);
      throw uniqueViolation();
    }
    const saved = { ...order, id: randomUUID(), status: OrderStatus.Pending } as Order;
    this.rows.push(saved);
    return saved;
  }

  async findOneOrFail(args: { where: Partial<Order> }): Promise<Order> {
    const found = await this.findOne(args);
    if (!found) {
      throw new Error('not found');
    }
    return found;
  }
}

const dto = { product: 'Desk lamp', quantity: 2, unitPriceCents: 1999 } as CreateOrderDto;

function setup() {
  const store = new FakeOrderStore();
  const orderCreated = jest.fn<OrderEventsPublisher['orderCreated']>().mockResolvedValue(undefined);
  const service = new OrdersService(
    asRepository<Order>(store),
    { orderCreated } as unknown as OrderEventsPublisher,
  );
  return { service, store, orderCreated };
}

describe('OrdersService.create: order events', () => {
  it('publishes once for a new order', async () => {
    const { service, orderCreated } = setup();

    const { order, replayed } = await service.create(randomUUID(), 'key-1', dto);

    expect(replayed).toBe(false);
    expect(orderCreated).toHaveBeenCalledTimes(1);
    expect(orderCreated).toHaveBeenCalledWith(order);
  });

  it('does not publish when the request is replayed', async () => {
    const { service, orderCreated } = setup();
    const customerId = randomUUID();
    await service.create(customerId, 'key-1', dto);

    const replay = await service.create(customerId, 'key-1', dto);

    expect(replay.replayed).toBe(true);
    expect(orderCreated).toHaveBeenCalledTimes(1);
  });

  it('does not publish when it loses a race to a concurrent request with the same key', async () => {
    const { service, store, orderCreated } = setup();
    const customerId = randomUUID();
    store.raceWinner = fakeOrder({ customerId, idempotencyKey: 'key-1', ...dto, totalCents: 3998 });

    const result = await service.create(customerId, 'key-1', dto);

    expect(result).toEqual({ order: store.raceWinner, replayed: true });
    expect(orderCreated).not.toHaveBeenCalled();
  });
});