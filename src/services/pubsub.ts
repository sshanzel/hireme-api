import {PubSub, Topic, Subscription, Message} from '@google-cloud/pubsub';

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'local-project';

// Client automatically uses PUBSUB_EMULATOR_HOST if set
const pubsub = new PubSub({projectId: PROJECT_ID});

export async function ensureTopic(topicName: string): Promise<Topic> {
  const topic = pubsub.topic(topicName);
  const [exists] = await topic.exists();

  if (!exists) {
    const [newTopic] = await pubsub.createTopic(topicName);
    console.log(`Topic ${topicName} created`);
    return newTopic;
  }

  return topic;
}

export async function ensureSubscription(
  topicName: string,
  subscriptionName: string
): Promise<Subscription> {
  const topic = await ensureTopic(topicName);
  const subscription = topic.subscription(subscriptionName);
  const [exists] = await subscription.exists();

  if (!exists) {
    const [newSubscription] = await topic.createSubscription(subscriptionName);
    console.log(`Subscription ${subscriptionName} created`);
    return newSubscription;
  }

  return subscription;
}

export async function publish<T>(topicName: string, data: T): Promise<string> {
  const topic = await ensureTopic(topicName);
  const messageBuffer = Buffer.from(JSON.stringify(data));
  const messageId = await topic.publishMessage({data: messageBuffer});
  return messageId;
}

export async function subscribe(
  topicName: string,
  subscriptionName: string,
  handler: (message: Message) => void
): Promise<Subscription> {
  const subscription = await ensureSubscription(topicName, subscriptionName);

  subscription.on('message', handler);
  subscription.on('error', (error) => {
    console.error('Subscription error:', error);
  });

  console.log(`Listening on subscription: ${subscriptionName}`);
  return subscription;
}

export {pubsub, Message};
