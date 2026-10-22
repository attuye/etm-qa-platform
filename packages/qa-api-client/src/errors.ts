import { z } from 'zod';

export interface ResponseDetails {
  method: string;
  url: string;
  status: number;
  body: unknown;
}

function formatBody(body: unknown): string {
  if (body === undefined || body === '' ) {
    return '(empty)';
  }
  return JSON.stringify(body, null, 2);
}

export class ApiError extends Error {
  constructor(
    readonly response: ResponseDetails,
    readonly expectedStatus: readonly number[],
  ) {
    super(
      [
        `${response.method} ${response.url}`,
        `Expected status: ${expectedStatus.join(' or ')}`,
        `Received status: ${response.status}`,
        `Response body: ${formatBody(response.body)}`,
      ].join('\n'),
    );
    this.name = 'ApiError';
  }

  get status(): number {
    return this.response.status;
  }
}

export class ContractError extends Error {
  constructor(
    readonly response: ResponseDetails,
    schemaName: string,
    zodError: z.ZodError,
  ) {
    super(
      [
        `${response.method} ${response.url}`,
        `Response does not match the ${schemaName} contract:`,
        z.prettifyError(zodError),
        `Response body: ${formatBody(response.body)}`,
      ].join('\n'),
    );
    this.name = 'ContractError';
  }
}