import { z } from 'zod';

export const customerNotificationSchema = z.strictObject({
  id: z.uuid(),
  eventId: z.string(),
  customerId: z.uuid(),
  orderId: z.uuid(),
  message: z.string(),
  createdAt: z.iso.datetime(),
});

export const eventFailureStatusSchema = z.enum(['retrying', 'parked']);

export const eventFailureSchema = z.strictObject({
  eventKey: z.string(),
  subscription: z.string(),
  status: eventFailureStatusSchema,
  reason: z.string(),
  attempts: z.number().int().positive(),
  payload: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type CustomerNotification = z.infer<typeof customerNotificationSchema>;
export type EventFailure = z.infer<typeof eventFailureSchema>;
export type EventFailureStatus = z.infer<typeof eventFailureStatusSchema>;