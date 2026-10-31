export interface WaitForOptions {
  description: string;
  timeoutMs?: number;
  intervalMs?: number;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function show(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? String(value);
}

/** Polls until `accept` returns true, then returns the value. Fails with the last value seen. */
export async function waitFor<T>(
  probe: () => Promise<T>,
  accept: (value: T) => boolean,
  { description, timeoutMs = 10_000, intervalMs = 250 }: WaitForOptions,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T | undefined;
  let lastError: unknown;

  for (;;) {
    try {
      last = await probe();
      if (accept(last)) {
        return last;
      }
      lastError = undefined;
    } catch (error) {
      lastError = error;
    }
    if (Date.now() >= deadline) {
      const errorText = lastError instanceof Error ? `\nLast error: ${lastError.message}` : '';
      throw new Error(
        `Timed out after ${timeoutMs} ms waiting for ${description}.\nLast value: ${show(last)}${errorText}`,
      );
    }
    await sleep(intervalMs);
  }
}

/** Checks that `check` stays true for the whole window: the way to test that something does NOT happen. */
export async function holdsFor<T>(
  probe: () => Promise<T>,
  check: (value: T) => boolean,
  { description, timeoutMs = 2_000, intervalMs = 250 }: WaitForOptions,
): Promise<T> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (!check(value)) {
      throw new Error(`Expected ${description} to hold for ${timeoutMs} ms, but it changed:\n${show(value)}`);
    }
    if (Date.now() >= end) {
      return value;
    }
    await sleep(intervalMs);
  }
}