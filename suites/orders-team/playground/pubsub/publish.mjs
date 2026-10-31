import { randomUUID } from 'node:crypto';
import { pubsub, TOPIC } from './common.mjs';

const count = Number(process.argv[2] ?? 3);
const duplicate = process.argv.includes('--duplicate');
const topic = pubsub.topic(TOPIC);

for (let i = 1; i <= count; i++) {
  const event = {
    eventId: randomUUID(),
    type: 'order.created',
    orderNumber: i,
    occurredAt: new Date().toISOString(),
  };
  // --duplicate publishes each event twice, like a producer that retried
  // after a timeout even though the first publish had worked.
  const copies = duplicate ? 2 : 1;
  for (let c = 0; c < copies; c++) {
    const messageId = await topic.publishMessage({
      json: event,
      attributes: { eventId: event.eventId, type: event.type },
    });
    console.log(`published order #${i} eventId=${event.eventId.slice(0, 8)} messageId=${messageId}`);
  }
}
await pubsub.close();