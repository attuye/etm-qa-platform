import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/order.entity';
import { EventFailure } from './event-failure.entity';
import { Notification } from './notification.entity';
import { EventFailuresController, NotificationsController } from './notifications.controller';
import { NotificationsConsumer } from './notifications.consumer';
import { OrderEventsPublisher } from './order-events.publisher';
import { PubSubService } from './pubsub.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Notification, EventFailure])],
  controllers: [NotificationsController, EventFailuresController],
  providers: [PubSubService, OrderEventsPublisher, NotificationsConsumer],
  exports: [OrderEventsPublisher],
})
export class EventsModule {}