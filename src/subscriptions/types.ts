import {Message} from '@google-cloud/pubsub';

// Message is optional - not used in Cloud Run push mode
export type SubscriptionHandler<T> = (data: T, message?: Message) => Promise<void>;

export interface SubscriptionConfig<T = any> {
  topic: string;
  subscription: string;
  handler: SubscriptionHandler<T>;
}
