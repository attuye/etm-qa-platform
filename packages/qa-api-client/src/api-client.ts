import { loadConfig, QaConfig } from '@etm/qa-config';
import { AuthClient } from './clients/auth.client';
import { HealthClient } from './clients/health.client';
import { HttpClient, HttpMethod, RawResponse, RequestOptions } from './http';
import { Credentials } from './schemas';
import { Session } from './session';

export interface ApiClientOptions {
  baseUrl: string;
  timeoutMs: number;
  adminCredentials?: Credentials;
}

export class ApiClient {
  readonly health: HealthClient;
  readonly auth: AuthClient;

  private readonly http: HttpClient;
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly options: ApiClientOptions) {
    this.http = new HttpClient(options.baseUrl, options.timeoutMs);
    this.health = new HealthClient(this.http);
    this.auth = new AuthClient(this.http);
  }

  as(credentials: Credentials): Session {
    const key = credentials.email.trim().toLowerCase();
    const existing = this.sessions.get(key);
    if (existing && existing.credentials.password === credentials.password) {
      return existing;
    }

    const session = new Session(this.http, this.auth, credentials);
    this.sessions.set(key, session);
    return session;
  }

  asAdmin(): Session {
    if (!this.options.adminCredentials) {
      throw new Error('No admin credentials configured. Set ADMIN_EMAIL and ADMIN_PASSWORD.');
    }
    return this.as(this.options.adminCredentials);
  }

  raw(method: HttpMethod, path: string, options?: RequestOptions): Promise<RawResponse> {
    return this.http.raw(method, path, options);
  }
}

export function createApiClient(config: QaConfig = loadConfig()): ApiClient {
  return new ApiClient({
    baseUrl: config.apiBaseUrl,
    timeoutMs: config.httpTimeoutMs,
    adminCredentials: config.admin,
  });
}