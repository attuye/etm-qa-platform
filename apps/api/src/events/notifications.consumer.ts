import { Message } from '@google-cloud/pubsub';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { z } from 'zod';
import { Order } from '../orders/order.entity';
import { EventFailure } from './event-failure.entity';
import { Notification } from './notification.entity';
import { NOTIFICATIONS_SUBSCRIPTION, orderCreatedEventSchema } from './order-events';
import { PubSubService } from './pubsub.service';

export const MAX_ATTEMPTS = 5;
const POSTGRES_UNIQUE_VIOLATION = '23505';

export type ProcessOutcome = 'processed' | 'duplicate' | 'parked' | 'retry';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

@Injectable()
export class NotificationsConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationsConsumer.name);

  constructor(
    private readonly pubsub: PubSubService,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    @InjectRepository(EventFailure) private readonly failures: Repository<EventFailure>,
  ) {}

  onApplicationBootstrap(): void {
    if (this.pubsub.enabled) {
      this.pubsub.subscribe(NOTIFICATIONS_SUBSCRIPTION, (message) => this.handle(message));
    }
  }

  private async handle(message: Message): Promise<void> {
    try {
      const outcome = await this.process(message.id, message.data);
      this.logger.log(`messageId=${message.id} -> ${outcome}`);
      if (outcome === 'retry') {
        message.nack();
      } else {
        message.ack();
      }
    } catch (error) {
      // Even recording the failure failed (e.g. database down): let Pub/Sub redeliver.
      this.logger.error(`messageId=${message.id} -> unexpected error, nack: ${errorText(error)}`);
      message.nack();
    }
  }

  async process(messageId: string, data: Buffer): Promise<ProcessOutcome> {
    const raw = data.toString('utf8');

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return this.park(`message:${messageId}`, 'Body is not valid JSON', raw);
    }

    const result = orderCreatedEventSchema.safeParse(parsed);
    if (!result.success) {
      const eventId = (parsed as { eventId?: unknown } | null)?.eventId;
      const key = typeof eventId === 'string' ? eventId : `message:${messageId}`;
      return this.park(key, `Invalid event: ${z.prettifyError(result.error)}`, raw);
    }

    const event = result.data;
    try {
      const order = await this.orders.findOne({ where: { id: event.data.orderId } });
      if (!order) {
        return this.retryOrPark(event.eventId, 'Order not found (yet)', raw);
      }
      if (order.customerId !== event.data.customerId) {
        return this.park(event.eventId, 'customerId does not match the order', raw);
      }

      try {
        await this.notifications.insert({
          eventId: event.eventId,
          customerId: order.customerId,
          orderId: order.id,
          message: `Order received: ${order.quantity} x ${order.product}, total ${formatCents(order.totalCents)}`,
        });
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          return 'duplicate';
        }
        throw error;
      }

      await this.failures.delete({ eventKey: event.eventId });
      return 'processed';
    } catch (error) {
      return this.retryOrPark(event.eventId, errorText(error), raw);
    }
  }

  private async park(eventKey: string, reason: string, payload: string): Promise<ProcessOutcome> {
    const existing = await this.failures.findOne({ where: { eventKey } });
    await this.failures.save({
      eventKey,
      subscription: NOTIFICATIONS_SUBSCRIPTION,
      status: 'parked',
      reason,
      attempts: (existing?.attempts ?? 0) + 1,
      payload: payload.slice(0, 2000),
    });
    return 'parked';
  }

  private async retryOrPark(eventKey: string, reason: string, payload: string): Promise<ProcessOutcome> {
    const existing = await this.failures.findOne({ where: { eventKey } });
    const attempts = (existing?.attempts ?? 0) + 1;
    const giveUp = attempts >= MAX_ATTEMPTS;
    await this.failures.save({
      eventKey,
      subscription: NOTIFICATIONS_SUBSCRIPTION,
      status: giveUp ? 'parked' : 'retrying',
      reason: giveUp ? `Gave up after ${attempts} attempts: ${reason}` : reason,
      attempts,
      payload: payload.slice(0, 2000),
    });
    return giveUp ? 'parked' : 'retry';
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION
    );
  }
}