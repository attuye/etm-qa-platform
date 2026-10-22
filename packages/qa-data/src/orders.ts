import type { CreateOrderInput } from '@etm/qa-api-client';
import { faker } from './random';

export const ORDER_LIMITS = {
  minQuantity: 1,
  maxQuantity: 1000,
  maxProductLength: 100,
} as const;

export const orderData = {
  valid(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
    return {
      product: faker.commerce.productName(),
      quantity: faker.number.int({ min: 1, max: 10 }),
      unitPriceCents: faker.number.int({ min: 100, max: 50_000 }),
      ...overrides,
    };
  },
};