import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export type PublicUser = Pick<User, 'id' | 'email' | 'role' | 'createdAt'>;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<PublicUser> {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create(email, passwordHash);
    return this.toPublicUser(user);
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);

    const passwordMatches = user ? await bcrypt.compare(dto.password, user.passwordHash) : false;
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.jwtService.signAsync({ sub: user.id, role: user.role });
    return { accessToken };
  }

  private toPublicUser(user: User): PublicUser {
    return { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt };
  }
}