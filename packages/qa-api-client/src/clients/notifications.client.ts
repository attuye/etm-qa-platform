import { z } from 'zod';
import { HttpClient } from '../http';
import {
  CustomerNotification,
  customerNotificationSchema,
  EventFailure,
  eventFailureSchema,
} from '../schemas';
import { TokenProvider } from './users.client';

export class NotificationsClient {
  constructor(
    private readonly http: HttpClient,
    private readonly getToken: TokenProvider,
  ) {}

  async list(): Promise<CustomerNotification[]> {
    const res = await this.http.expect('get', '/notifications', {
      token: await this.getToken(),
      expectedStatus: [200],
      schema: z.array(customerNotificationSchema),
      schemaName: 'CustomerNotification[]',
    });
    return res.data;
  }
}

export class EventFailuresClient {
  constructor(
    private readonly http: HttpClient,
    private readonly getToken: TokenProvider,
  ) {}

  async list(): Promise<EventFailure[]> {
    const res = await this.http.expect('get', '/admin/event-failures', {
      token: await this.getToken(),
      expectedStatus: [200],
      schema: z.array(eventFailureSchema),
      schemaName: 'EventFailure[]',
    });
    return res.data;
  }
}