import * as gcp from '@pulumi/gcp';
import {projectId} from './config';

// Enable required GCP APIs
const requiredApis = [
  'run.googleapis.com',
  'artifactregistry.googleapis.com',
  'pubsub.googleapis.com',
  'iam.googleapis.com',
  'cloudresourcemanager.googleapis.com',
];

export const enabledApis = requiredApis.map(
  api =>
    new gcp.projects.Service(api, {
      service: api,
      disableOnDestroy: false,
    })
);

// Create Pub/Sub service identity (required for dead letter publishing)
export const pubsubServiceIdentity = new gcp.projects.ServiceIdentity(
  'pubsub-service-identity',
  {
    project: projectId,
    service: 'pubsub.googleapis.com',
  },
  {
    dependsOn: enabledApis,
  }
);
