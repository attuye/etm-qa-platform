import request from 'supertest';
import { z } from 'zod';
import { ApiError, ContractError, ResponseDetails } from './errors';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface RequestOptions {
  token?: string;
  body?: object;
  headers?: Record<string, string>;
}

export interface RawResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
  details: ResponseDetails;
}

export interface ExpectOptions<S extends z.ZodType> extends RequestOptions {
  expectedStatus: readonly number[];
  schema: S;
  schemaName: string;
}

export interface TypedResponse<T> {
  status: number;
  headers: Record<string, string>;
  data: T;
}

function describeNetworkError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const code = (error as NodeJS.ErrnoException).code;

  if (error instanceof AggregateError && error.errors.length > 0) {
    const inner = error.errors.map((e: unknown) => describeNetworkError(e)).join('; ');
    return code ? `${code} (${inner})` : inner;
  }

  if (error.message) {
    return code && !error.message.includes(code) ? `${code}: ${error.message}` : error.message;
  }

  return code ?? error.name;
}

export class HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  async raw(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<RawResponse> {
    const url = `${this.baseUrl}${path}`;
    let req = request(this.baseUrl)[method](path).timeout(this.timeoutMs);

    if (options.token) {
      req = req.set('Authorization', `Bearer ${options.token}`);
    }
    for (const [name, value] of Object.entries(options.headers ?? {})) {
      req = req.set(name, value);
    }
    if (options.body !== undefined) {
      req = req.send(options.body);
    }

    let res: request.Response;
    try {
      res = await req;
    } catch (error) {
            const reason = describeNetworkError(error);
      throw new Error(`${method.toUpperCase()} ${url} failed before a response: ${reason}. Is the API running?`, {
        cause: error,
      });
    }

    const body: unknown = res.body;
    return {
      status: res.status,
      body,
      headers: res.headers as Record<string, string>,
      details: { method: method.toUpperCase(), url, status: res.status, body },
    };
  }

  async expect<S extends z.ZodType>(
    method: HttpMethod,
    path: string,
    options: ExpectOptions<S>,
  ): Promise<TypedResponse<z.output<S>>> {
    const res = await this.raw(method, path, options);

    if (!options.expectedStatus.includes(res.status)) {
      throw new ApiError(res.details, options.expectedStatus);
    }

    const parsed = options.schema.safeParse(res.body);
    if (!parsed.success) {
      throw new ContractError(res.details, options.schemaName, parsed.error);
    }

    return { status: res.status, headers: res.headers, data: parsed.data };
  }
}