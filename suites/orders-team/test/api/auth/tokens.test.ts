import { beforeAll, describe, expect, it } from '@jest/globals';
import { ApiClient, createApiClient, Session } from '@etm/qa-api-client';
import { createCustomer } from '@etm/qa-data';
import { decodePayload, unsignedToken, withForgedClaims } from '../../support/jwt';

describe('Access tokens on protected routes', () => {
  let api: ApiClient;
  let alice: Session;
  let token: string;

  beforeAll(async () => {
    api = createApiClient();
    alice = await createCustomer(api);
    token = await alice.getToken();
  });

  it('accepts a valid token and identifies the user', async () => {
    const me = await alice.users.me();

    expect(me.email).toBe(alice.email);
  });

  it('contains the user id and role, and an expiry', () => {
    const claims = decodePayload(token);

    expect(claims).toMatchObject({ role: 'customer', sub: expect.any(String) });
    expect(claims.exp).toEqual(expect.any(Number));
  });

  it('rejects a request with no Authorization header', async () => {
    expect(await api.raw('get', '/users/me')).toHaveStatus(401);
  });

  it.each([
    ['a token that is not a JWT', 'Bearer not-a-jwt'],
    ['an empty Bearer value', 'Bearer '],
    ['the wrong scheme', 'TOKEN_PLACEHOLDER'],
  ])('rejects %s', async (_label, header) => {
    const value = header === 'TOKEN_PLACEHOLDER' ? `Token ${token}` : header;

    const res = await api.raw('get', '/users/me', { headers: { Authorization: value } });

    expect(res).toHaveStatus(401);
  });

  it('rejects a token whose role was changed to admin', async () => {
    const forged = withForgedClaims(token, { role: 'admin' });

    expect(await api.raw('get', '/users', { token: forged })).toHaveStatus(401);
  });

  it('rejects a token whose user id was changed', async () => {
    const bob = await createCustomer(api);
    const bobId = (await bob.users.me()).id;
    const forged = withForgedClaims(token, { sub: bobId });

    expect(await api.raw('get', '/users/me', { token: forged })).toHaveStatus(401);
  });

  it('rejects an unsigned token (alg: none)', async () => {
    const { sub } = decodePayload(token);
    const forged = unsignedToken({ sub, role: 'admin' });

    expect(await api.raw('get', '/users', { token: forged })).toHaveStatus(401);
  });
});