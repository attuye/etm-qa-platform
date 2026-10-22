import { expect } from '@jest/globals';
import { ApiError } from '@etm/qa-api-client';

expect.extend({
  toHaveStatus(received: unknown, expected: number) {
    if (!(received instanceof ApiError)) {
      const description =
        received instanceof Error ? `${received.name}: ${received.message}` : String(received);
      return {
        pass: false,
        message: () => `Expected an ApiError with status ${expected}, but got:\n${description}`,
      };
    }

    const pass = received.status === expected;
    return {
      pass,
      message: () =>
        pass
          ? `Expected status not to be ${expected}.\n\n${received.message}`
          : `Expected status ${expected}, but the API returned ${received.status}.\n\n${received.message}`,
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