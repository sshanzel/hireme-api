import * as gcp from '@pulumi/gcp';
import {region, projectId, workerMaxInstances, databaseUrl, openaiApiKey, gcsBucketName, cvParserApiUrl, cvParserApiKey, imageTag} from '../config';
import {workerServiceAccount, pubsubInvokerServiceAccount} from '../iam';
import {enabledApis} from '../apis';

// Cloud Run Worker service
export const workerService = new gcp.cloudrunv2.Service(
  'core-worker',
  {
    name: 'core-worker',
    location: region,
    ingress: 'INGRESS_TRAFFIC_INTERNAL_ONLY', // Only Pub/Sub can access
    template: {
      serviceAccount: workerServiceAccount.email,
      scaling: {
        minInstanceCount: 0,
        maxInstanceCount: workerMaxInstances,
      },
      timeout: '540s', // 9 min for long-running tasks like CV parsing
      containers: [
        {
          image: `${region}-docker.pkg.dev/${projectId}/core-api/worker:${imageTag}`,
          ports: {containerPort: 8080},
          resources: {
            limits: {
              memory: '1Gi', // More memory for CV parsing
              cpu: '1',
            },
            cpuIdle: true, // CPU can be throttled when idle
            startupCpuBoost: true,
          },
          envs: [
            {name: 'NODE_ENV', value: 'production'},
            {name: 'GCP_PROJECT_ID', value: projectId},
            {name: 'DATABASE_URL', value: databaseUrl},
            {name: 'OPENAI_API_KEY', value: openaiApiKey},
            {name: 'GCS_BUCKET_NAME', value: gcsBucketName},
            {name: 'CV_PARSER_API_URL', value: cvParserApiUrl},
            {name: 'CV_PARSER_API_KEY', value: cvParserApiKey},
          ],
          startupProbe: {
            httpGet: {
              path: '/',
              port: 8080,
            },
            initialDelaySeconds: 0,
            periodSeconds: 10,
            failureThreshold: 3,
            timeoutSeconds: 5,
          },
        },
      ],
    },
  },
  {dependsOn: enabledApis}
);

// Only Pub/Sub service account can invoke the worker
export const workerInvoker = new gcp.cloudrunv2.ServiceIamMember('worker-invoker', {
  name: workerService.name,
  location: region,
  role: 'roles/run.invoker',
  member: pubsubInvokerServiceAccount.email.apply(email => `serviceAccount:${email}`),
});

// Export the worker URL (used by Pub/Sub subscriptions)
export const workerUrl = workerService.uri;
