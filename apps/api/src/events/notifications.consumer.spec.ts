import { randomUUID } from 'node:crypto';
import type { Message } from '@google-cloud/pubsub';
import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Order } from '../orders/order.entity';
import {
    asRepository,
    FakeEventFailureRepository,
    FakeNotificationRepository,
    FakeOrderRepository,
    fakeOrder,
} from '../testing/fakes';
import { EventFailure } from './event-failure.entity';
import { Notification } from './notification.entity';
import { MAX_ATTEMPTS, NotificationsConsumer } from './notifications.consumer';
import { OrderCreatedEvent } from './order-events';
import { PubSubService } from './pubsub.service';

function setup() {
    const orders = new FakeOrderRepository();
    const notifications = new FakeNotificationRepository();
    const failures = new FakeEventFailureRepository();
    const consumer = new NotificationsConsumer(
        { enabled: false } as unknown as PubSubService,
        asRepository<Order>(orders),
        asRepository<Notification>(notifications),
        asRepository<EventFailure>(failures),
    );
    return { consumer, orders, notifications, failures };
}

function eventFor(order: Order, overrides: Partial<OrderCreatedEvent['data']> = {}): OrderCreatedEvent {
    return {
        eventId: randomUUID(),
        type: 'order.created',
        occurredAt: new Date().toISOString(),
        data: {
            orderId: order.id,
            customerId: order.customerId,
            product: order.product,
            quantity: order.quantity,
            totalCents: order.totalCents,
            ...overrides,
        },
    };
}

const bytes = (value: unknown): Buffer =>
    Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));

describe('NotificationsConsumer.process', () => {
    it('creates a notification from the database order', async () => {
        const { consumer, orders, notifications } = setup();
        const order = orders.add(fakeOrder());

        const outcome = await consumer.process('1', bytes(eventFor(order)));

        expect(outcome).toBe('processed');
        expect(notifications.rows).toEqual([
            expect.objectContaining({
                orderId: order.id,
                customerId: order.customerId,
                message: 'Order received: 2 x Desk lamp, total $39.98',
            }),
        ]);
    });

    it('uses the database values, not the values in the event', async () => {
        const { consumer, orders, notifications } = setup();
        const order = orders.add(fakeOrder());

        await consumer.process('1', bytes(eventFor(order, { product: 'Something else', totalCents: 1 })));

        expect(notifications.rows[0]?.message).toBe('Order received: 2 x Desk lamp, total $39.98');
    });

    it('treats a second delivery of the same event as a duplicate', async () => {
        const { consumer, orders, notifications } = setup();
        const order = orders.add(fakeOrder());
        const event = eventFor(order);

        const first = await consumer.process('1', bytes(event));
        const second = await consumer.process('2', bytes(event));

        expect([first, second]).toEqual(['processed', 'duplicate']);
        expect(notifications.rows).toHaveLength(1);
    });

    it('parks a body that is not JSON after one attempt', async () => {
        const { consumer, failures } = setup();

        const outcome = await consumer.process('77', bytes('not json'));

        expect(outcome).toBe('parked');
        expect(failures.rows.get('message:77')).toMatchObject({
            status: 'parked',
            attempts: 1,
            reason: 'Body is not valid JSON',
            payload: 'not json',
        });
    });

    it('parks an event that breaks the schema, keyed by its eventId', async () => {
        const { consumer, failures } = setup();
        const eventId = randomUUID();

        const outcome = await consumer.process('1', bytes({ eventId, type: 'order.created' }));

        expect(outcome).toBe('parked');
        expect(failures.rows.get(eventId)?.reason).toContain('Invalid event');
    });

    it(`retries a missing order ${MAX_ATTEMPTS - 1} times, then parks it`, async () => {
        const { consumer, failures } = setup();
        const event = eventFor(fakeOrder()); // order never added to the repository

        const outcomes: string[] = [];
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            outcomes.push(await consumer.process(String(attempt), bytes(event)));
        }

        expect(outcomes).toEqual([...Array<string>(MAX_ATTEMPTS - 1).fill('retry'), 'parked']);
        expect(failures.rows.get(event.eventId)).toMatchObject({
            status: 'parked',
            attempts: MAX_ATTEMPTS,
            reason: `Gave up after ${MAX_ATTEMPTS} attempts: Order not found (yet)`,
        });
    });

    it('recovers when the order appears after a retry, and cleans up the failure record', async () => {
        const { consumer, orders, notifications, failures } = setup();
        const order = fakeOrder();
        const event = eventFor(order);

        expect(await consumer.process('1', bytes(event))).toBe('retry');
        expect(failures.rows.get(event.eventId)?.status).toBe('retrying');

        orders.add(order); // e.g. a database replica caught up
        expect(await consumer.process('2', bytes(event))).toBe('processed');

        expect(notifications.rows).toHaveLength(1);
        expect(failures.rows.has(event.eventId)).toBe(false);
    });

    it('retries when the database fails, recording the reason', async () => {
        const { consumer, orders, failures } = setup();
        const event = eventFor(orders.add(fakeOrder()));
        orders.failWith = new Error('Connection terminated unexpectedly');

        const outcome = await consumer.process('1', bytes(event));

        expect(outcome).toBe('retry');
        expect(failures.rows.get(event.eventId)).toMatchObject({
            status: 'retrying',
            attempts: 1,
            reason: 'Connection terminated unexpectedly',
        });
    });

    it('parks an event whose customer does not match the order, creating nothing', async () => {
        const { consumer, orders, notifications, failures } = setup();
        const event = eventFor(orders.add(fakeOrder()), { customerId: randomUUID() });

        const outcome = await consumer.process('1', bytes(event));

        expect(outcome).toBe('parked');
        expect(notifications.rows).toHaveLength(0);
        expect(failures.rows.get(event.eventId)?.reason).toBe('customerId does not match the order');
    });
});

describe('NotificationsConsumer.handle (ack / nack)', () => {
    beforeEach(() => {
        jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });
    function message(data: Buffer) {
        return { id: '42', data, ack: jest.fn(), nack: jest.fn() };
    }

    async function handle(consumer: NotificationsConsumer, msg: ReturnType<typeof message>) {
        // handle() is private; bracket access is TypeScript's deliberate escape hatch for tests.
        await consumer['handle'](msg as unknown as Message);
    }

    it('acks a processed message', async () => {
        const { consumer, orders } = setup();
        const msg = message(bytes(eventFor(orders.add(fakeOrder()))));

        await handle(consumer, msg);

        expect(msg.ack).toHaveBeenCalledTimes(1);
        expect(msg.nack).not.toHaveBeenCalled();
    });

    it('acks a parked message, so it is never redelivered', async () => {
        const { consumer } = setup();
        const msg = message(bytes('not json'));

        await handle(consumer, msg);

        expect(msg.ack).toHaveBeenCalledTimes(1);
        expect(msg.nack).not.toHaveBeenCalled();
    });

    it('nacks a message that should be retried', async () => {
        const { consumer } = setup();
        const msg = message(bytes(eventFor(fakeOrder())));

        await handle(consumer, msg);

        expect(msg.nack).toHaveBeenCalledTimes(1);
        expect(msg.ack).not.toHaveBeenCalled();
    });

    it('nacks, without crashing, when even recording the failure fails', async () => {
        const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        const { consumer, orders, failures } = setup();
        const msg = message(bytes(eventFor(orders.add(fakeOrder()))));
        orders.failWith = new Error('database down');
        failures.failWith = new Error('database down');

        await expect(handle(consumer, msg)).resolves.toBeUndefined();

        expect(msg.nack).toHaveBeenCalledTimes(1);
        expect(errorLog).toHaveBeenCalledWith('messageId=42 -> unexpected error, nack: database down');
    });
});