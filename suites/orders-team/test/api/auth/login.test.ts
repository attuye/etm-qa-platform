import { beforeAll, describe, expect, it } from '@jest/globals';
import { ApiClient, createApiClient, errorResponseSchema } from '@etm/qa-api-client';
import { userData } from '@etm/qa-data';

describe('POST /auth/login', () => {
  let api: ApiClient;

  beforeAll(() => {
    api = createApiClient();
  });

  it('accepts the email in any letter case', async () => {
    const credentials = userData.credentials();
    await api.auth.register(credentials);

    const { accessToken } = await api.auth.login({
      ...credentials,
      email: credentials.email.toUpperCase(),
    });

    expect(accessToken).toEqual(expect.any(String));
  });

  it('rejects a wrong password', async () => {
    const credentials = userData.credentials();
    await api.auth.register(credentials);

    await expect(
      api.auth.login({ ...credentials, password: 'Wrong-Passw0rd!' }),
    ).rejects.toHaveStatus(401);
  });

  it('rejects an email that is not registered', async () => {
    await expect(api.auth.login(userData.credentials())).rejects.toHaveStatus(401);
  });

  it('gives the same error for an unknown email and a wrong password', async () => {
    const credentials = userData.credentials();
    await api.auth.register(credentials);

    const wrongPassword = await api.raw('post', '/auth/login', {
      body: { ...credentials, password: 'Wrong-Passw0rd!' },
    });
    const unknownEmail = await api.raw('post', '/auth/login', {
      body: userData.credentials(),
    });

    expect(wrongPassword).toHaveStatus(401);
    expect(unknownEmail).toHaveStatus(401);
    expect(errorResponseSchema.parse(wrongPassword.body).message).toBe(
      errorResponseSchema.parse(unknownEmail.body).message,
    );
  });

  it('rejects an empty password with 400', async () => {
    const res = await api.raw('post', '/auth/login', {
      body: userData.credentials({ password: '' }),
    });

    expect(res).toHaveStatus(400);
  });
});