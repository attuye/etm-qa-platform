import { z } from 'zod';

export const loginResponseSchema = z.strictObject({
  accessToken: z.string().min(1),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export interface Credentials {
  email: string;
  password: string;
}