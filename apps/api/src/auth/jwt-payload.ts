import type { Request } from 'express';
import { Role } from '../users/role.enum';

export interface JwtPayload {
  sub: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}