import { z } from 'zod';

export const ORDER_EVENTS_TOPIC = 'order-events';
export const NOTIFICATIONS_SUBSCRIPTION = 'order-events-notifications';

export const orderCreatedEventSchema = z.object({
  eventId: z.uuid(),
  type: z.literal('order.created'),
  occurredAt: z.iso.datetime(),
  data: z.object({
    orderId: z.uuid(),
    customerId: z.string().min(1),
    product: z.string().min(1),
    quantity: z.number().int().positive(),
    totalCents: z.number().int().nonnegative(),
  }),
});

export type OrderCreatedEvent = z.infer<typeof orderCreatedEventSchema>;