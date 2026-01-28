import * as gcp from '@pulumi/gcp';
import {region} from './config';
import {apiUrl} from './cloudrun';
import {enabledApis} from './apis';

export const dbWarmupJob = new gcp.cloudscheduler.Job(
  'db-warmup',
  {
    name: 'db-warmup',
    region: region,
    schedule: '0 */4 * * *', // Every 4 hours
    timeZone: 'UTC',
    httpTarget: {
      uri: apiUrl.apply(url => `${url}/health`),
      httpMethod: 'GET',
    },
    retryConfig: {
      retryCount: 1,
    },
  },
  {dependsOn: enabledApis},
);
