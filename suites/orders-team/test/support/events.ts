import { randomUUID } from 'node:crypto';
import { describe } from '@jest/globals';
import { PubSub } from '@google-cloud/pubsub';
import { loadConfig } from '@etm/qa-config';

const config = loadConfig();

// Copied from the API's events module. If the two drift apart, the contract tests below fail.
export const ORDER_EVENTS_TOPIC = 'order-events';
export const MAX_ATTEMPTS = 5;

/** Black-box event tests: need an API with events switched on. */
export function describeIfEvents(name: string, tests: () => void): void {
    (config.events.enabled ? describe : describe.skip)(name, tests);
}

/** Gray-box tests: also need publish access (the emulator). */
export function describeIfProducer(name: string, tests: () => void): void {
    (config.events.enabled && config.events.pubsub ? describe : describe.skip)(name, tests);
}

export interface OrderCreatedEvent {
    eventId: string;
    type: 'order.created';
    occurredAt: string;
    data: {
        orderId: string;
        customerId: string;
        product: string;
        quantity: number;
        totalCents: number;
    };
}

export function orderCreatedEvent(
    data: { orderId: string; customerId: string } & Partial<OrderCreatedEvent['data']>,
    eventId: string = randomUUID(),
): OrderCreatedEvent {
    return {
        eventId,
        type: 'order.created',
        occurredAt: new Date().toISOString(),
        data: { product: 'Test producer item', quantity: 1, totalCents: 1000, ...data },
    };
}

/** Publishes to the real topic, like another service would: the "test producer". */
export class TestProducer {
    private readonly client: PubSub;

    constructor() {
        const pubsub = config.events.pubsub;
        if (!pubsub) {
            throw new Error('TestProducer needs PUBSUB_EMULATOR_HOST');
        }
        process.env.PUBSUB_EMULATOR_HOST = pubsub.emulatorHost;
        process.env.METADATA_SERVER_DETECTION ??= 'none';
        this.client = new PubSub({ projectId: pubsub.projectId });
    }

    publishEvent(event: object): Promise<string> {
        return this.client.topic(ORDER_EVENTS_TOPIC).publishMessage({ json: event });
    }

    publishRaw(body: string): Promise<string> {
        return this.client.topic(ORDER_EVENTS_TOPIC).publishMessage({ data: Buffer.from(body) });
    }

    close(): Promise<void> {
        return this.client.close();
    }
}