import * as gcp from '@pulumi/gcp';
import * as pulumi from '@pulumi/pulumi';
import {projectId} from '../config';
import {enabledApis} from '../apis';

// Service account for the API
export const apiServiceAccount = new gcp.serviceaccount.Account(
  'core-api-sa',
  {
    accountId: 'core-api',
    displayName: 'Core API Service Account',
    description: 'Service account for the Core API Cloud Run service',
  },
  {dependsOn: enabledApis}
);

// Service account for the Worker
export const workerServiceAccount = new gcp.serviceaccount.Account(
  'core-worker-sa',
  {
    accountId: 'core-worker',
    displayName: 'Core Worker Service Account',
    description: 'Service account for the Core Worker Cloud Run service',
  },
  {dependsOn: enabledApis}
);

// Service account for Pub/Sub to invoke Cloud Run
export const pubsubInvokerServiceAccount = new gcp.serviceaccount.Account(
  'pubsub-invoker-sa',
  {
    accountId: 'pubsub-invoker',
    displayName: 'Pub/Sub Invoker Service Account',
    description: 'Service account for Pub/Sub to invoke Cloud Run worker',
  },
  {dependsOn: enabledApis}
);

// API permissions: Pub/Sub editor, Storage admin
new gcp.projects.IAMMember(
  'api-pubsub-editor',
  {
    project: projectId,
    role: 'roles/pubsub.editor',
    member: pulumi.interpolate`serviceAccount:${apiServiceAccount.email}`,
  },
  {dependsOn: enabledApis}
);

new gcp.projects.IAMMember(
  'api-storage-admin',
  {
    project: projectId,
    role: 'roles/storage.objectAdmin',
    member: pulumi.interpolate`serviceAccount:${apiServiceAccount.email}`,
  },
  {dependsOn: enabledApis}
);

// Worker permissions: Pub/Sub subscriber, Storage viewer
new gcp.projects.IAMMember(
  'worker-pubsub-subscriber',
  {
    project: projectId,
    role: 'roles/pubsub.subscriber',
    member: pulumi.interpolate`serviceAccount:${workerServiceAccount.email}`,
  },
  {dependsOn: enabledApis}
);

new gcp.projects.IAMMember(
  'worker-storage-viewer',
  {
    project: projectId,
    role: 'roles/storage.objectViewer',
    member: pulumi.interpolate`serviceAccount:${workerServiceAccount.email}`,
  },
  {dependsOn: enabledApis}
);

// Pub/Sub invoker needs permission to create tokens
new gcp.projects.IAMMember(
  'pubsub-invoker-token-creator',
  {
    project: projectId,
    role: 'roles/iam.serviceAccountTokenCreator',
    member: pulumi.interpolate`serviceAccount:${pubsubInvokerServiceAccount.email}`,
  },
  {dependsOn: enabledApis}
);
