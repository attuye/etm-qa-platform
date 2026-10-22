import { randomInt } from 'node:crypto';
import { createApiClient } from '@etm/qa-api-client';
import { loadConfig } from '@etm/qa-config';

export default async function globalSetup(): Promise<void> {
  const config = loadConfig();

  const seed = process.env.DATA_SEED ?? String(randomInt(1_000_000));
  process.env.DATA_SEED = seed;

  console.log(`\n[qa] env=${config.testEnv} api=${config.apiBaseUrl} seed=${seed}`);
  console.log(`[qa] To reproduce this run's data, set DATA_SEED=${seed}\n`);

  try {
    await createApiClient(config).health.check();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`API is not healthy at ${config.apiBaseUrl}. Start it before running tests.\n${reason}`);
  }
}