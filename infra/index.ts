import * as pulumi from '@pulumi/pulumi';
import {projectId, region, environment} from './src/config';

// Enable APIs first (other resources depend on these)
export {enabledApis, pubsubServiceIdentity} from './src/apis';
import {repository, repositoryUrl} from './src/artifact-registry';
import {
  apiServiceAccount,
  workerServiceAccount,
  pubsubInvokerServiceAccount,
} from './src/iam';
import {apiService, apiUrl, workerService, workerUrl} from './src/cloudrun';
import {createPubSubResources, topicNames} from './src/pubsub';

// Create Pub/Sub resources with worker URL
const pubsub = createPubSubResources(workerUrl);

// Stack outputs
export const outputs = {
  // Project info
  project: projectId,
  region: region,
  environment: environment,

  // Artifact Registry
  artifactRegistry: repositoryUrl,

  // Cloud Run URLs
  apiUrl: apiUrl,
  workerUrl: workerUrl,

  // Service Accounts
  apiServiceAccount: apiServiceAccount.email,
  workerServiceAccount: workerServiceAccount.email,

  // Pub/Sub topics
  topics: topicNames,
};

// Export individual values for easy access
export {apiUrl, workerUrl};
