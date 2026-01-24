import {Message} from '@google-cloud/pubsub';
import {subscribe} from '../services/pubsub.ts';
import type {SubscriptionConfig} from './types.ts';
import {cvUploadParsingSubscription} from './cvUploadParsing.ts';
import {storyCanonicalizationSubscription} from './storyCanonicalization.ts';
import {experienceIndexingSubscription} from './experienceIndexing.ts';

const subscriptions: SubscriptionConfig[] = [
  cvUploadParsingSubscription,
  storyCanonicalizationSubscription,
  experienceIndexingSubscription,
];

export async function registerSubscriptions(): Promise<void> {
  for (const config of subscriptions) {
    await subscribe(config.topic, config.subscription, async (message: Message) => {
      try {
        const data = JSON.parse(message.data.toString());
        await config.handler(data, message);
        message.ack();
      } catch (error) {
        console.error(`Error processing message from ${config.subscription}:`, error);
        message.nack();
      }
    });
    console.log(`Registered subscription: ${config.subscription} -> ${config.topic}`);
  }
}

export {subscriptions};
