import { z } from 'zod';

export const roleSchema = z.enum(['admin', 'customer']);
export const orderStatusSchema = z.enum(['pending', 'confirmed', 'shipped', 'cancelled']);

export const healthSchema = z.strictObject({
  status: z.literal('ok'),
  database: z.literal('up'),
  timestamp: z.iso.datetime(),
});

export const publicUserSchema = z.strictObject({
  id: z.uuid(),
  email: z.email(),
  role: roleSchema,
  createdAt: z.iso.datetime(),
});

export const loginResponseSchema = z.strictObject({
  accessToken: z.string().min(1),
});

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

export type Role = z.infer<typeof roleSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type Health = z.infer<typeof healthSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type Order = z.infer<typeof orderSchema>;

export interface Credentials {
  email: string;
  password: string;
}

export interface CreateOrderInput {
  product: string;
  quantity: number;
  unitPriceCents: number;
}