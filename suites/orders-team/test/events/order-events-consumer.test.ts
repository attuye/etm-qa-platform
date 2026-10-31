import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { ApiClient, createApiClient, type EventFailure, type Session } from '@etm/qa-api-client';
import { createCustomer, orderData } from '@etm/qa-data';
import { describeIfProducer, MAX_ATTEMPTS, orderCreatedEvent, TestProducer } from '../support/events';
import { holdsFor, waitFor } from '../support/wait-for';

describeIfProducer('Notifications consumer (gray-box: test producer on the emulator)', () => {
  let api: ApiClient;
  let producer: TestProducer;

  beforeAll(() => {
    api = createApiClient();
    producer = new TestProducer();
  });

  afterAll(async () => {
    await producer.close();
  });

  async function customerWithOrder() {
    const customer = await createCustomer(api);
    const { order } = await customer.orders.create(orderData.valid());
    await waitFor(() => customer.notifications.list(), (list) => list.length === 1, {
      description: "the notification from the API's own event",
    });
    return { customer, order };
  }

  function parked(match: (failure: EventFailure) => boolean, description: string) {
    return waitFor(
      async () => (await api.asAdmin().eventFailures.list()).find(match),
      (failure) => failure?.status === 'parked',
      { description, timeoutMs: 15_000 },
    );
  }

  function countStays(customer: Session, count: number) {
    return holdsFor(() => customer.notifications.list(), (list) => list.length === count, {
      description: `${count} notification(s)`,
    });
  }

  it('processes a duplicated event only once', async () => {
    const { customer, order } = await customerWithOrder();
    const event = orderCreatedEvent({ orderId: order.id, customerId: order.customerId });

    await producer.publishEvent(event);
    await producer.publishEvent(event); // same eventId: a producer that retried

    const list = await waitFor(() => customer.notifications.list(), (l) => l.length >= 2, {
      description: 'the notification for our event',
    });
    await countStays(customer, 2);
    expect(list.filter((n) => n.eventId === event.eventId)).toHaveLength(1);
  });

  it('parks a message that is not JSON, without retrying it', async () => {
    const body = `not json ${randomUUID()}`;
    const messageId = await producer.publishRaw(body);

    const failure = await parked((f) => f.eventKey === `message:${messageId}` && f.payload === body, 'the non-JSON message to be parked');

    expect(failure).toMatchObject({ status: 'parked', reason: 'Body is not valid JSON' });
  });

  it('parks an event that breaks the schema, with a readable reason', async () => {
    const eventId = randomUUID();
    await producer.publishEvent({ eventId, type: 'order.created', data: { quantity: 'two' } });

    const failure = await parked((f) => f.eventKey === eventId, 'the invalid event to be parked');

    expect(failure).toMatchObject({ status: 'parked', attempts: 1 });
    expect(failure?.reason).toContain('Invalid event');
    expect(failure?.reason).toContain('occurredAt');
    expect(failure?.reason).toContain('quantity');
  });

  it(`retries an event for an unknown order, then parks it after ${MAX_ATTEMPTS} attempts`, async () => {
    const event = orderCreatedEvent({ orderId: randomUUID(), customerId: randomUUID() });
    await producer.publishEvent(event);

    const failure = await parked((f) => f.eventKey === event.eventId, 'the unknown-order event to be parked');

    expect(failure).toMatchObject({ status: 'parked', attempts: MAX_ATTEMPTS });
    expect(failure?.reason).toBe(`Gave up after ${MAX_ATTEMPTS} attempts: Order not found (yet)`);
  });

  it('refuses a forged event that names the wrong customer', async () => {
    const { customer, order } = await customerWithOrder();
    const forged = orderCreatedEvent({ orderId: order.id, customerId: randomUUID() });

    await producer.publishEvent(forged);

    const failure = await parked((f) => f.eventKey === forged.eventId, 'the forged event to be parked');
    expect(failure?.reason).toBe('customerId does not match the order');
    await countStays(customer, 1);
  });

  it('keeps processing good orders while poison messages arrive', async () => {
    await Promise.all([
      producer.publishRaw('poison 1'),
      producer.publishRaw('poison 2'),
      producer.publishEvent({ eventId: randomUUID(), type: 'nonsense' }),
      producer.publishEvent(orderCreatedEvent({ orderId: randomUUID(), customerId: randomUUID() })),
    ]);

    const customer = await createCustomer(api);
    const { order } = await customer.orders.create(orderData.valid());

    const notifications = await waitFor(() => customer.notifications.list(), (l) => l.length === 1, {
      description: 'the good order to be notified despite the poison messages',
    });
    expect(notifications[0]?.orderId).toBe(order.id);
  });
});