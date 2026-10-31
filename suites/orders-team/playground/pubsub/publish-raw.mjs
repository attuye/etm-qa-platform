import { randomUUID } from 'node:crypto';
import { pubsub } from './common.mjs';

const ORDER_EVENTS = 'order-events';
const mode = process.argv[2];

const wellFormed = () => ({
  eventId: randomUUID(),
  type: 'order.created',
  occurredAt: new Date().toISOString(),
  data: {
    orderId: randomUUID(), // an order that doesn't exist
    customerId: randomUUID(),
    product: 'Raw lamp',
    quantity: 1,
    totalCents: 1000,
  },
});

let body;
if (mode === 'not-json') {
  body = 'this is not json';
} else if (mode === 'bad-schema') {
  body = JSON.stringify({ eventId: randomUUID(), type: 'order.created', data: { quantity: 'two' } });
} else if (mode === 'unknown-order') {
  body = JSON.stringify(wellFormed());
} else {
  console.log('Usage: node publish-raw.mjs not-json | bad-schema | unknown-order');
  process.exit(1);
}

const messageId = await pubsub.topic(ORDER_EVENTS).publishMessage({ data: Buffer.from(body) });
console.log(`published ${mode} messageId=${messageId}`);
await pubsub.close();