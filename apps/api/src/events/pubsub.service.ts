import { Message, PubSub, Subscription } from '@google-cloud/pubsub';
import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NOTIFICATIONS_SUBSCRIPTION, ORDER_EVENTS_TOPIC } from './order-events';

const PUBLISH_TIMEOUT_MS = 3000;
const SETUP_TIMEOUT_MS = 10000;

async function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

@Injectable()
export class PubSubService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(PubSubService.name);
  private readonly client: PubSub | null;
  private readonly subscriptions: Subscription[] = [];
  readonly enabled: boolean;

  constructor(config: ConfigService) {
    this.enabled = config.get<string>('PUBSUB_ENABLED') === 'true';
    this.client = this.enabled
      ? new PubSub({ projectId: config.getOrThrow<string>('PUBSUB_PROJECT_ID') })
      : null;
  }

  async onModuleInit(): Promise<void> {
    if (!this.client) {
      this.logger.log('Pub/Sub disabled (PUBSUB_ENABLED is not "true")');
      return;
    }
    if (!process.env.PUBSUB_EMULATOR_HOST) {
      this.logger.log('Using real Pub/Sub: topics and subscriptions are managed by infrastructure');
      return;
    }
    await withTimeout(this.ensureResources(), SETUP_TIMEOUT_MS,
      `Pub/Sub setup (is the emulator running? docker compose up -d pubsub)`);
    this.logger.log(`Pub/Sub ready: topic ${ORDER_EVENTS_TOPIC}, subscription ${NOTIFICATIONS_SUBSCRIPTION}`);
  }

  async publish(topic: string, event: { eventId: string; type: string }): Promise<string> {
    const client = this.requireClient();
    return withTimeout(
      client.topic(topic).publishMessage({
        json: event,
        attributes: { eventId: event.eventId, type: event.type },
      }),
      PUBLISH_TIMEOUT_MS,
      `Publishing ${event.type}`,
    );
  }

  subscribe(name: string, handler: (message: Message) => Promise<void>): void {
    const subscription = this.requireClient().subscription(name, {
      flowControl: { maxMessages: 10 },
    });
    subscription.on('message', (message: Message) => {
      void handler(message);
    });
    subscription.on('error', (error: Error) => {
      this.logger.error(`Subscription ${name} error: ${error.message}`);
    });
    this.subscriptions.push(subscription);
    this.logger.log(`Listening on ${name}`);
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all(this.subscriptions.map((subscription) => subscription.close()));
    await this.client?.close();
  }

  private async ensureResources(): Promise<void> {
    const client = this.requireClient();
    const topic = client.topic(ORDER_EVENTS_TOPIC);
    const [topicExists] = await topic.exists();
    if (!topicExists) {
      await client.createTopic(ORDER_EVENTS_TOPIC);
    }
    const [subscriptionExists] = await topic.subscription(NOTIFICATIONS_SUBSCRIPTION).exists();
    if (!subscriptionExists) {
      await topic.createSubscription(NOTIFICATIONS_SUBSCRIPTION, { ackDeadlineSeconds: 10 });
    }
  }

  private requireClient(): PubSub {
    if (!this.client) {
      throw new Error('Pub/Sub is disabled');
    }
    return this.client;
  }
}