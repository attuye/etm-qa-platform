const { createApiClient, ApiError } = require('@etm/qa-api-client');
const { randomUUID } = require('node:crypto');

async function main() {
  const api = createApiClient();

  console.log('Health:', await api.health.check());

  const alice = { email: `alice-${randomUUID()}@example.com`, password: 'Passw0rd!' };
  const bob = { email: `bob-${randomUUID()}@example.com`, password: 'Passw0rd!' };
  await api.auth.register(alice);
  await api.auth.register(bob);

  const order = { product: 'Laptop stand', quantity: 2, unitPriceCents: 4500 };
  const first = await api.as(alice).orders.create(order);
  const second = await api.as(alice).orders.create(order, { idempotencyKey: first.idempotencyKey });
  console.log('First replayed?', first.replayed, '| Second replayed?', second.replayed);
  console.log('Same order?', first.order.id === second.order.id);

  try {
    await api.as(bob).orders.get(first.order.id);
  } catch (error) {
    if (error instanceof ApiError) {
      console.log(`Bob got ${error.status}, as expected`);
    } else {
      throw error;
    }
  }

  const users = await api.asAdmin().users.list();
  console.log('Admin sees', users.length, 'users');

  await api.as(alice).orders.get('not-a-uuid');
}

main().catch((error) => {
  console.error('\n--- Error ---\n' + error.message);
  process.exit(1);
});