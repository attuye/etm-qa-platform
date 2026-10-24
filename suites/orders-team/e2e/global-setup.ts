import { randomInt } from 'node:crypto';
import { createApiClient } from '@etm/qa-api-client';
import { loadConfig } from '@etm/qa-config';

const PAGES_TO_WARM = ['/login', '/register', '/orders', '/orders/new', '/admin/orders'];

export default async function globalSetup(): Promise<void> {
  const config = loadConfig();

  const seed = process.env.DATA_SEED ?? String(randomInt(1_000_000));
  process.env.DATA_SEED = seed;
  console.log(`\n[qa] env=${config.testEnv} web=${config.webBaseUrl} api=${config.apiBaseUrl} seed=${seed}\n`);

  try {
    await createApiClient(config).health.check();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`API is not healthy at ${config.apiBaseUrl}. Start it before running tests.\n${reason}`);
  }

  for (const path of PAGES_TO_WARM) {
    const url = `${config.webBaseUrl}${path}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Web app is not reachable at ${url}. Start it with: npm run dev -w @etm/web\n${reason}`,
      );
    }
  }
}