import { User } from './user.entity';

export type PublicUser = Pick<User, 'id' | 'email' | 'role' | 'createdAt'>;

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt };
}