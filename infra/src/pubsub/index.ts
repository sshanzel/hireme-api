import * as gcp from '@pulumi/gcp';
import * as pulumi from '@pulumi/pulumi';
import {pubsubInvokerServiceAccount} from '../iam';
import {pubsubServiceIdentity, enabledApis} from '../apis';

interface TopicConfig {
  name: string;
  subscriptionName: string;
  endpoint: string;
  ackDeadlineSeconds?: number;
}

const topicConfigs: TopicConfig[] = [
  {
    name: 'api.v1.cv-uploaded',
    subscriptionName: 'api.v1.cv-uploaded-parsing',
    endpoint: '/events/cv-uploaded',
    ackDeadlineSeconds: 120,
  },
  {
    name: 'api.v1.story-completed',
    subscriptionName: 'api.v1.story-completed-canonicalization',
    endpoint: '/events/story-completed',
    ackDeadlineSeconds: 60,
  },
  {
    name: 'api.v1.experience-updated',
    subscriptionName: 'api.v1.experience-updated-indexing',
    endpoint: '/events/experience-updated',
    ackDeadlineSeconds: 60,
  },
];

interface PubSubResources {
  topics: gcp.pubsub.Topic[];
  subscriptions: gcp.pubsub.Subscription[];
}

export function createPubSubResources(workerUrl: pulumi.Output<string>): PubSubResources {
  const topics: gcp.pubsub.Topic[] = [];
  const subscriptions: gcp.pubsub.Subscription[] = [];

  // Single shared dead letter topic (messages here are just dropped after retention)
  const deadLetterTopic = new gcp.pubsub.Topic(
    'dead-letter',
    {
      name: 'api.v1.dead-letter',
      messageRetentionDuration: '86400s', // 1 day then dropped
    },
    {dependsOn: enabledApis}
  );

  // Grant Pub/Sub permission to publish to dead letter topic
  new gcp.pubsub.TopicIAMMember(
    'dead-letter-publisher',
    {
      topic: deadLetterTopic.name,
      role: 'roles/pubsub.publisher',
      member: pubsubServiceIdentity.email.apply(email => `serviceAccount:${email}`),
    },
    {
      dependsOn: [pubsubServiceIdentity],
    }
  );

  for (const config of topicConfigs) {
    const topic = new gcp.pubsub.Topic(
      config.name,
      {
        name: config.name,
        messageRetentionDuration: '86400s',
      },
      {dependsOn: enabledApis}
    );
    topics.push(topic);

    const subscription = new gcp.pubsub.Subscription(config.subscriptionName, {
      name: config.subscriptionName,
      topic: topic.name,
      ackDeadlineSeconds: config.ackDeadlineSeconds ?? 60,
      messageRetentionDuration: '86400s',
      pushConfig: {
        pushEndpoint: pulumi.interpolate`${workerUrl}${config.endpoint}`,
        oidcToken: {
          serviceAccountEmail: pubsubInvokerServiceAccount.email,
        },
      },
      deadLetterPolicy: {
        deadLetterTopic: deadLetterTopic.id,
        maxDeliveryAttempts: 10,
      },
      retryPolicy: {
        minimumBackoff: '10s',
        maximumBackoff: '60s',
      },
      expirationPolicy: {
        ttl: '',
      },
    });
    subscriptions.push(subscription);
  }

  return {topics, subscriptions};
}

export const topicNames = topicConfigs.map(c => c.name);
