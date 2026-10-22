import { z } from 'zod';

export const roleSchema = z.enum(['admin', 'customer']);

export const publicUserSchema = z.strictObject({
  id: z.uuid(),
  email: z.email(),
  role: roleSchema,
  createdAt: z.iso.datetime(),
});

export type Role = z.infer<typeof roleSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;