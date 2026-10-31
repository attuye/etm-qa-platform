import { AuthClient } from './clients/auth.client';
import { OrdersClient } from './clients/orders.client';
import { UsersClient } from './clients/users.client';
import { HttpClient } from './http';
import { Credentials } from './schemas';
import { EventFailuresClient, NotificationsClient } from './clients/notifications.client';

export class Session {
  readonly users: UsersClient;
  readonly orders: OrdersClient;
  readonly notifications: NotificationsClient;
  readonly eventFailures: EventFailuresClient;

  private token?: string;
  private pendingLogin?: Promise<string>;

  constructor(
    http: HttpClient,
    private readonly auth: AuthClient,
    readonly credentials: Credentials,
  ) {
    const getToken = (): Promise<string> => this.getToken();
    this.users = new UsersClient(http, getToken);
    this.orders = new OrdersClient(http, getToken);
    this.notifications = new NotificationsClient(http, getToken);
    this.eventFailures = new EventFailuresClient(http, getToken);
  }

  get email(): string {
    return this.credentials.email;
  }

  async getToken(): Promise<string> {
    if (this.token) {
      return this.token;
    }

    this.pendingLogin ??= this.auth.login(this.credentials).then((res) => res.accessToken);
    try {
      this.token = await this.pendingLogin;
      return this.token;
    } finally {
      this.pendingLogin = undefined;
    }
  }
}