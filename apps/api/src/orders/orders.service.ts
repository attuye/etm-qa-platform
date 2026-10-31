import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { JwtPayload } from '../auth/jwt-payload';
import { Role } from '../users/role.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from './order-status.enum';
import { Order } from './order.entity';
import { OrderEventsPublisher } from '../events/order-events.publisher';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.Pending]: [OrderStatus.Confirmed, OrderStatus.Cancelled],
  [OrderStatus.Confirmed]: [OrderStatus.Shipped, OrderStatus.Cancelled],
  [OrderStatus.Shipped]: [],
  [OrderStatus.Cancelled]: [],
};

const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class OrdersService {
  constructor(@InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly orderEvents: OrderEventsPublisher,) { }

  async create(
    customerId: string,
    idempotencyKey: string,
    dto: CreateOrderDto,
  ): Promise<{ order: Order; replayed: boolean }> {
    const existing = await this.orders.findOne({ where: { customerId, idempotencyKey } });
    if (existing) {
      this.assertSamePayload(existing, dto);
      return { order: existing, replayed: true };
    }

    const order = this.orders.create({
      customerId,
      idempotencyKey,
      product: dto.product,
      quantity: dto.quantity,
      unitPriceCents: dto.unitPriceCents,
      totalCents: dto.quantity * dto.unitPriceCents,
    });

    let saved: Order;
    try {
      saved = await this.orders.save(order);
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }
      const winner = await this.orders.findOneOrFail({ where: { customerId, idempotencyKey } });
      this.assertSamePayload(winner, dto);
      return { order: winner, replayed: true };
    }

    await this.orderEvents.orderCreated(saved);
    return { order: saved, replayed: false };
  }

  findAllFor(user: JwtPayload): Promise<Order[]> {
    const where = user.role === Role.Admin ? {} : { customerId: user.sub };
    return this.orders.find({ where, order: { createdAt: 'ASC' } });
  }

  async findOneFor(user: JwtPayload, id: string): Promise<Order> {
    const where = user.role === Role.Admin ? { id } : { id, customerId: user.sub };
    const order = await this.orders.findOne({ where });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!ALLOWED_TRANSITIONS[order.status].includes(status)) {
      throw new ConflictException(`Cannot change status from ${order.status} to ${status}`);
    }

    order.status = status;
    return this.orders.save(order);
  }

  private assertSamePayload(order: Order, dto: CreateOrderDto): void {
    const same =
      order.product === dto.product &&
      order.quantity === dto.quantity &&
      order.unitPriceCents === dto.unitPriceCents;

    if (!same) {
      throw new UnprocessableEntityException(
        'Idempotency-Key was already used with a different request body',
      );
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION
    );
  }
}