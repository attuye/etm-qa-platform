import { z } from 'zod';
import { HttpClient } from '../http';
import { PublicUser, publicUserSchema } from '../schemas';

export type TokenProvider = () => Promise<string>;

export class UsersClient {
  constructor(
    private readonly http: HttpClient,
    private readonly getToken: TokenProvider,
  ) {}

  async me(): Promise<PublicUser> {
    const res = await this.http.expect('get', '/users/me', {
      token: await this.getToken(),
      expectedStatus: [200],
      schema: publicUserSchema,
      schemaName: 'PublicUser',
    });
    return res.data;
  }

  async list(): Promise<PublicUser[]> {
    const res = await this.http.expect('get', '/users', {
      token: await this.getToken(),
      expectedStatus: [200],
      schema: z.array(publicUserSchema),
      schemaName: 'PublicUser[]',
    });
    return res.data;
  }
}