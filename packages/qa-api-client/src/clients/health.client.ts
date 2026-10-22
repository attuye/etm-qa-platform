import { HttpClient } from '../http';
import { Health, healthSchema } from '../schemas';

export class HealthClient {
  constructor(private readonly http: HttpClient) {}

  async check(): Promise<Health> {
    const res = await this.http.expect('get', '/health', {
      expectedStatus: [200],
      schema: healthSchema,
      schemaName: 'Health',
    });
    return res.data;
  }
}