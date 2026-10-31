import { pubsub, SUBSCRIPTION, TOPIC } from './common.mjs';

const ALREADY_EXISTS = 6; // gRPC status code

async function ensure(name, create) {
  try {
    await create();
    console.log(`created ${name}`);
  } catch (error) {
    if (error.code !== ALREADY_EXISTS) throw error;
    console.log(`${name} already exists`);
  }
}

await ensure(`topic ${TOPIC}`, () => pubsub.createTopic(TOPIC));
await ensure(`subscription ${SUBSCRIPTION}`, () =>
  pubsub.topic(TOPIC).createSubscription(SUBSCRIPTION, { ackDeadlineSeconds: 10 }),
);
await pubsub.close();