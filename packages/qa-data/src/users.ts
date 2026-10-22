import type { ApiClient, Credentials, Session } from '@etm/qa-api-client';
import { uniqueEmail } from './unique';

export const VALID_PASSWORD = 'Passw0rd!Qa';

export const userData = {
  credentials(overrides: Partial<Credentials> = {}): Credentials {
    return { email: uniqueEmail('customer'), password: VALID_PASSWORD, ...overrides };
  },

  password: {
    tooShort: 'a'.repeat(7),
    minLength: 'a'.repeat(8),
    maxLength: 'a'.repeat(72),
    tooLong: 'a'.repeat(73),
  },
};

export async function createCustomer(
  api: ApiClient,
  overrides: Partial<Credentials> = {},
): Promise<Session> {
  const credentials = userData.credentials(overrides);
  await api.auth.register(credentials);
  return api.as(credentials);
}