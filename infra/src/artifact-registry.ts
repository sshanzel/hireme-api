import * as gcp from '@pulumi/gcp';
import {region} from './config';
import {enabledApis} from './apis';

// Docker repository for container images
export const repository = new gcp.artifactregistry.Repository(
  'core-api-repo',
  {
    location: region,
    repositoryId: 'core-api',
    format: 'DOCKER',
    description: 'Docker repository for core-api images',
  },
  {
    dependsOn: enabledApis,
  }
);

// Export the repository URL for use in CI/CD
export const repositoryUrl = repository.name.apply(
  name => `${region}-docker.pkg.dev/${name.split('/')[1]}/core-api`
);
