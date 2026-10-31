import { z } from 'zod';

export const testEnvironments = ['local', 'ci', 'staging'] as const;

export const qaConfigSchema = z
  .object({
    TEST_ENV: z.enum(testEnvironments).default('local'),
    API_BASE_URL: z.url().default('http://localhost:3001/api'),
    WEB_BASE_URL: z.url().default('http://localhost:3000'),
    ADMIN_EMAIL: z.email(),
    ADMIN_PASSWORD: z.string().min(1),
    HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
    EVENTS_ENABLED: z.stringbool().default(false),
    PUBSUB_EMULATOR_HOST: z.string().min(1).optional(),
    PUBSUB_PROJECT_ID: z.string().min(1).default('etm-local'),
  })
  .transform((env) => ({
    testEnv: env.TEST_ENV,
    apiBaseUrl: env.API_BASE_URL.replace(/\/+$/, ''),
    webBaseUrl: env.WEB_BASE_URL.replace(/\/+$/, ''),
    admin: { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD },
    httpTimeoutMs: env.HTTP_TIMEOUT_MS,
    events: {
      enabled: env.EVENTS_ENABLED,
      pubsub: env.PUBSUB_EMULATOR_HOST
        ? { emulatorHost: env.PUBSUB_EMULATOR_HOST, projectId: env.PUBSUB_PROJECT_ID }
        : null,
    },
  }));

export type QaConfig = z.infer<typeof qaConfigSchema>;