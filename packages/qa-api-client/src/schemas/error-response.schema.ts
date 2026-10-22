import { z } from 'zod';

export const errorResponseSchema = z.strictObject({
  statusCode: z.number().int(),
  message: z.union([z.string(), z.array(z.string())]),
  error: z.string().optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;