import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../users/role.enum';
import { EventFailure } from './event-failure.entity';
import { Notification } from './notification.entity';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayload): Promise<Notification[]> {
    return this.notifications.find({
      where: { customerId: user.sub },
      order: { createdAt: 'ASC' },
    });
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/event-failures')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventFailuresController {
  constructor(
    @InjectRepository(EventFailure) private readonly failures: Repository<EventFailure>,
  ) {}

  @Get()
  @Roles(Role.Admin)
  list(): Promise<EventFailure[]> {
    return this.failures.find({ order: { updatedAt: 'DESC' } });
  }
}