import { expect } from '@jest/globals';
import { ApiError, type RawResponse } from '@etm/qa-api-client';

function isRawResponse(value: unknown): value is RawResponse {
  return typeof value === 'object' && value !== null && 'status' in value && 'details' in value;
}

function describeResponse(res: RawResponse): string {
  const { method, url, status, body } = res.details;
  return `${method} ${url}\nReceived status: ${status}\nResponse body: ${JSON.stringify(body, null, 2)}`;
}

expect.extend({
  toHaveStatus(received: unknown, expected: number) {
    let actual: number;
    let details: string;

    if (received instanceof ApiError) {
      actual = received.status;
      details = received.message;
    } else if (isRawResponse(received)) {
      actual = received.status;
      details = describeResponse(received);
    } else {
      const description =
        received instanceof Error ? `${received.name}: ${received.message}` : String(received);
      return {
        pass: false,
        message: () => `Expected an ApiError or raw response with status ${expected}, but got:\n${description}`,
      };
    }

    const pass = actual === expected;
    return {
      pass,
      message: () =>
        pass
          ? `Expected status not to be ${expected}.\n\n${details}`
          : `Expected status ${expected}, but the API returned ${actual}.\n\n${details}`,
    };
  },
});

declare module 'expect' {
  interface AsymmetricMatchers {
    toHaveStatus(status: number): void;
  }
  interface Matchers<R> {
    toHaveStatus(status: number): R;
  }
}