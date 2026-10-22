import { HttpClient } from '../http';
import { Credentials, LoginResponse, loginResponseSchema, PublicUser, publicUserSchema } from '../schemas';

export class AuthClient {
  constructor(private readonly http: HttpClient) {}

  async register(credentials: Credentials): Promise<PublicUser> {
    const res = await this.http.expect('post', '/auth/register', {
      body: credentials,
      expectedStatus: [201],
      schema: publicUserSchema,
      schemaName: 'PublicUser',
    });
    return res.data;
  }

  async login(credentials: Credentials): Promise<LoginResponse> {
    const res = await this.http.expect('post', '/auth/login', {
      body: credentials,
      expectedStatus: [200],
      schema: loginResponseSchema,
      schemaName: 'LoginResponse',
    });
    return res.data;
  }
}