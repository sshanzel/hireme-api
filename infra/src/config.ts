import * as pulumi from '@pulumi/pulumi';

const config = new pulumi.Config();
const gcpConfig = new pulumi.Config('gcp');

export const projectId = gcpConfig.require('project');
export const region = gcpConfig.require('region');
export const environment = config.require('environment');

// Secrets - set via `pulumi config set --secret`
export const databaseUrl = config.requireSecret('databaseUrl');
export const jwtSecret = config.requireSecret('jwtSecret');
export const openaiApiKey = config.requireSecret('openaiApiKey');
export const cvParserApiKey = config.requireSecret('cvParserApiKey');

// Regular config - set via `pulumi config set`
export const gcsBucketName = config.require('gcsBucketName');
export const allowedOrigins = config.require('allowedOrigins');
export const cvParserApiUrl = config.get('cvParserApiUrl') ?? 'https://api.edenai.run';

// Optional configs with defaults
export const apiMaxInstances = config.getNumber('apiMaxInstances') ?? 3;
export const workerMaxInstances = config.getNumber('workerMaxInstances') ?? 2;

// Derived values
export const artifactRegistryUrl = `${region}-docker.pkg.dev/${projectId}/core-api`;
