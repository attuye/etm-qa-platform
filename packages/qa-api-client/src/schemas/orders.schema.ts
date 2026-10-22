import { z } from 'zod';

export const orderStatusSchema = z.enum(['pending', 'confirmed', 'shipped', 'cancelled']);

export const orderSchema = z.strictObject({
  id: z.uuid(),
  customerId: z.uuid(),
  product: z.string(),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().positive(),
  totalCents: z.number().int().positive(),
  status: orderStatusSchema,
  idempotencyKey: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type Order = z.infer<typeof orderSchema>;

export interface CreateOrderInput {
  product: string;
  quantity: number;
  unitPriceCents: number;
}