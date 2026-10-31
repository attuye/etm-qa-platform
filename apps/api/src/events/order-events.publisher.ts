import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Order } from '../orders/order.entity';
import { ORDER_EVENTS_TOPIC, OrderCreatedEvent } from './order-events';
import { PubSubService } from './pubsub.service';

@Injectable()
export class OrderEventsPublisher {
  private readonly logger = new Logger(OrderEventsPublisher.name);

  constructor(private readonly pubsub: PubSubService) {}

  async orderCreated(order: Order): Promise<void> {
    if (!this.pubsub.enabled) {
      return;
    }

    const event: OrderCreatedEvent = {
      eventId: randomUUID(),
      type: 'order.created',
      occurredAt: new Date().toISOString(),
      data: {
        orderId: order.id,
        customerId: order.customerId,
        product: order.product,
        quantity: order.quantity,
        totalCents: order.totalCents,
      },
    };

    try {
      const messageId = await this.pubsub.publish(ORDER_EVENTS_TOPIC, event);
      this.logger.log(`Published order.created eventId=${event.eventId} orderId=${order.id} messageId=${messageId}`);
    } catch (error) {
      // The order is already saved. Failing the request would not bring the event back
      // (a client retry is an idempotent replay, which publishes nothing). See the outbox finding.
      this.logger.error(
        `LOST EVENT order.created orderId=${order.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}