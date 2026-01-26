import * as gcp from '@pulumi/gcp';
import {gcsBucketName, projectId} from './config';

export const cvUploadsBucket = new gcp.storage.Bucket('cv-uploads', {
  name: gcsBucketName,
  location: 'ME-CENTRAL1',
  project: projectId,
  uniformBucketLevelAccess: true,
  publicAccessPrevention: 'enforced',
  lifecycleRules: [
    {
      action: {type: 'Delete'},
      condition: {age: 1}, // Delete files after 1 day
    },
  ],
});

export const bucketName = cvUploadsBucket.name;
