import { z } from 'zod';

export const healthSchema = z.strictObject({
  status: z.literal('ok'),
  database: z.literal('up'),
  timestamp: z.iso.datetime(),
});

export type Health = z.infer<typeof healthSchema>;