import {PubSub, Message} from '@google-cloud/pubsub';

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'local-project';

const pubsub = new PubSub({projectId: PROJECT_ID});

export async function publish<T>(topicName: string, data: T): Promise<string> {
  const topic = pubsub.topic(topicName);
  const messageBuffer = Buffer.from(JSON.stringify(data));
  const messageId = await topic.publishMessage({data: messageBuffer});
  return messageId;
}

export async function subscribe(
  topicName: string,
  subscriptionName: string,
  handler: (message: Message) => void
): Promise<void> {
  const subscription = pubsub.topic(topicName).subscription(subscriptionName);

  subscription.on('message', handler);
  subscription.on('error', error => {
    console.error('Subscription error:', error);
  });

  console.log(`Listening on subscription: ${subscriptionName}`);
}

export {pubsub, Message};
