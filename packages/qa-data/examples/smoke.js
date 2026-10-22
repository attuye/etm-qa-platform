const { createApiClient, ApiError } = require('@etm/qa-api-client');
const { createCustomer, orderData, getDataSeed, runId } = require('@etm/qa-data');

async function main() {
  console.log(`runId=${runId} seed=${getDataSeed()}`);
  const api = createApiClient();

  const alice = await createCustomer(api);
  const bob = await createCustomer(api);
  console.log('Alice:', alice.email);

  const input = orderData.valid();
  const first = await alice.orders.create(input);
  const replay = await alice.orders.create(input, { idempotencyKey: first.idempotencyKey });
  console.log('Order:', first.order.product, '| replayed:', replay.replayed, '| same id:', replay.order.id === first.order.id);

  try {
    await bob.orders.get(first.order.id);
    console.log('BUG: Bob could see Alice\'s order');
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    console.log(`Bob got ${error.status}, as expected`);
  }
}

main().catch((error) => {
  console.error('\n--- Error ---\n' + error.message);
  process.exit(1);
});