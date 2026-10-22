import { randomUUID } from 'node:crypto';

export const runId = randomUUID().slice(0, 8);

let counter = 0;

export function uniqueId(prefix: string): string {
  counter += 1;
  const safePrefix = prefix.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return `${safePrefix}-${runId}-${counter}-${randomUUID().slice(0, 6)}`;
}

export function uniqueEmail(prefix = 'user'): string {
  return `qa-${uniqueId(prefix)}@example.com`;
}