import { PubSub } from '@google-cloud/pubsub';

process.env.PUBSUB_EMULATOR_HOST ??= 'localhost:8085';
// Don't look for the Google Cloud metadata server: we're on a laptop, not GCP.
process.env.METADATA_SERVER_DETECTION ??= 'none';

export const TOPIC = 'playground-orders';
export const SUBSCRIPTION = 'playground-orders-sub';
export const pubsub = new PubSub({ projectId: 'etm-local' });