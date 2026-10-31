import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fakeOrder } from '../testing/fakes';
import { ORDER_EVENTS_TOPIC, orderCreatedEventSchema } from './order-events';
import { OrderEventsPublisher } from './order-events.publisher';
import { PubSubService } from './pubsub.service';

function setup(enabled = true) {
  const publish = jest.fn<PubSubService['publish']>().mockResolvedValue('1');
  const publisher = new OrderEventsPublisher({ enabled, publish } as unknown as PubSubService);
  return { publisher, publish };
}

describe('OrderEventsPublisher', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('publishes an event that satisfies the consumer contract', async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const { publisher, publish } = setup();
    const order = fakeOrder();

    await publisher.orderCreated(order);

    expect(publish).toHaveBeenCalledTimes(1);
    const [topic, event] = publish.mock.calls[0] ?? [];
    expect(topic).toBe(ORDER_EVENTS_TOPIC);
    expect(orderCreatedEventSchema.parse(event)).toMatchObject({
      type: 'order.created',
      data: {
        orderId: order.id,
        customerId: order.customerId,
        product: order.product,
        quantity: order.quantity,
        totalCents: order.totalCents,
      },
    });
  });

  it('does nothing when events are disabled', async () => {
    const { publisher, publish } = setup(false);

    await publisher.orderCreated(fakeOrder());

    expect(publish).not.toHaveBeenCalled();
  });

  it('does not fail the request when publishing fails, but logs a LOST EVENT', async () => {
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { publisher, publish } = setup();
    publish.mockRejectedValue(new Error('Publishing order.created timed out after 3000 ms'));
    const order = fakeOrder();

    await expect(publisher.orderCreated(order)).resolves.toBeUndefined();

    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining(`LOST EVENT order.created orderId=${order.id}`));
  });
});