import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';
import { QaConfig, qaConfigSchema } from './schema';

export interface LoadConfigOptions {
  envFile?: string;
  reload?: boolean;
}

let cachedConfig: QaConfig | undefined;

export function loadConfig(options: LoadConfigOptions = {}): QaConfig {
  if (cachedConfig && !options.reload) {
    return cachedConfig;
  }

  const envFile = options.envFile ?? path.resolve(process.cwd(), '.env');
  dotenv.config({ path: envFile, quiet: true });

  const result = qaConfigSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid QA configuration:\n${z.prettifyError(result.error)}`);
  }

  cachedConfig = Object.freeze(result.data);
  return cachedConfig;
}