import { pubsub, SUBSCRIPTION } from './common.mjs';

const mode = process.argv[2] ?? 'ack'; // ack | nack-first | crash | dedupe
const subscription = pubsub.subscription(SUBSCRIPTION);
const deliveries = new Map(); // messageId -> how many times we've seen it
const processedEvents = new Set(); // eventIds already processed
const started = Date.now();
const elapsed = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;

subscription.on('message', (message) => {
  const event = JSON.parse(message.data.toString('utf8'));
  const delivery = (deliveries.get(message.id) ?? 0) + 1;
  deliveries.set(message.id, delivery);
  const label = `[${elapsed()}] order #${event.orderNumber} messageId=${message.id} delivery ${delivery}`;

  if (mode === 'nack-first' && delivery === 1) {
    console.log(`${label} -> nack (simulated failure)`);
    message.nack();
    return;
  }
  if (mode === 'crash') {
    console.log(`${label} -> received, NOT acking`);
    return;
  }
  if (mode === 'dedupe') {
    if (processedEvents.has(event.eventId)) {
      console.log(`${label} -> duplicate eventId ${event.eventId.slice(0, 8)}: ack and skip`);
      message.ack();
      return;
    }
    processedEvents.add(event.eventId);
  }
  console.log(`${label} -> processed, ack`);
  message.ack();
});

subscription.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  await subscription.close();
  await pubsub.close();
  process.exit(0);
});

if (mode === 'crash') {
  setTimeout(() => {
    console.log('Simulating a crash: exiting without acking');
    process.exit(1);
  }, 3000);
} else {
  console.log(`Listening on ${SUBSCRIPTION} in "${mode}" mode. Ctrl+C to stop.`);
}