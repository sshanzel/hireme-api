import {Message} from '@google-cloud/pubsub';

export type SubscriptionHandler<T> = (data: T, message: Message) => Promise<void>;

export interface SubscriptionConfig<T = unknown> {
  topic: string;
  subscription: string;
  handler: SubscriptionHandler<T>;
}
