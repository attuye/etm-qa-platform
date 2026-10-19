import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../users/role.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Order } from './order.entity';
import { OrdersService } from './orders.service';

const MAX_IDEMPOTENCY_KEY_LENGTH = 100;

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles(Role.Customer)
  async create(
    @CurrentUser() user: JwtPayload,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateOrderDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Order> {
    const key = idempotencyKey?.trim();
    if (!key || key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      throw new BadRequestException(
        `Idempotency-Key header is required (max ${MAX_IDEMPOTENCY_KEY_LENGTH} characters)`,
      );
    }

    const { order, replayed } = await this.ordersService.create(user.sub, key, dto);
    if (replayed) {
      res.status(HttpStatus.OK);
      res.setHeader('Idempotent-Replayed', 'true');
    }
    return order;
  }

  @Get()
  list(@CurrentUser() user: JwtPayload): Promise<Order[]> {
    return this.ordersService.findAllFor(user);
  }

  @Get(':id')
  get(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Order> {
    return this.ordersService.findOneFor(user, id);
  }

  @Patch(':id/status')
  @Roles(Role.Admin)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<Order> {
    return this.ordersService.updateStatus(id, dto.status);
  }
}