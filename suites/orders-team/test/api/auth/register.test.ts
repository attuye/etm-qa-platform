import { beforeAll, describe, expect, it } from '@jest/globals';
import { ApiClient, createApiClient, errorResponseSchema } from '@etm/qa-api-client';
import { userData } from '@etm/qa-data';

describe('POST /auth/register', () => {
  let api: ApiClient;

  beforeAll(() => {
    api = createApiClient();
  });

  it('never returns the password hash', async () => {
    const user = await api.auth.register(userData.credentials());

    expect(user).not.toHaveProperty('passwordHash');
  });

  it('rejects an email that is already registered', async () => {
    const credentials = userData.credentials();
    await api.auth.register(credentials);

    await expect(api.auth.register(credentials)).rejects.toHaveStatus(409);
  });

  it('treats emails as case-insensitive', async () => {
    const credentials = userData.credentials();
    await api.auth.register(credentials);

    const variant = { ...credentials, email: credentials.email.toUpperCase() };

    await expect(api.auth.register(variant)).rejects.toHaveStatus(409);
  });

  it('rejects an email with surrounding spaces', async () => {
    const credentials = userData.credentials();

    const res = await api.raw('post', '/auth/register', {
      body: { ...credentials, email: `  ${credentials.email}  ` },
    });

    expect(res).toHaveStatus(400);
  });

  it('stores the email in lower case', async () => {
    const credentials = userData.credentials();

    const user = await api.auth.register({ ...credentials, email: credentials.email.toUpperCase() });

    expect(user.email).toBe(credentials.email);
  });

  it.each(['not-an-email', '', 'name@', '@example.com', 'name@example'])(
    'rejects the invalid email %j',
    async (email) => {
      const res = await api.raw('post', '/auth/register', {
        body: userData.credentials({ email }),
      });

      expect(res).toHaveStatus(400);
    },
  );

  it.each([
    { label: '7 characters (below minimum)', password: userData.password.tooShort, status: 400 },
    { label: '8 characters (minimum)', password: userData.password.minLength, status: 201 },
    { label: '72 characters (maximum)', password: userData.password.maxLength, status: 201 },
    { label: '73 characters (above maximum)', password: userData.password.tooLong, status: 400 },
  ])('password of $label returns $status', async ({ password, status }) => {
    const res = await api.raw('post', '/auth/register', {
      body: userData.credentials({ password }),
    });

    expect(res).toHaveStatus(status);
  });

  it('rejects missing fields with a list of validation messages', async () => {
    const res = await api.raw('post', '/auth/register', { body: {} });

    expect(res).toHaveStatus(400);
    const { message } = errorResponseSchema.parse(res.body);
    expect(Array.isArray(message)).toBe(true);
  });

  it('rejects an attempt to register as admin and creates no account', async () => {
    const credentials = userData.credentials();

    const res = await api.raw('post', '/auth/register', {
      body: { ...credentials, role: 'admin' },
    });

    expect(res).toHaveStatus(400);
    await expect(api.auth.login(credentials)).rejects.toHaveStatus(401);
  });
});