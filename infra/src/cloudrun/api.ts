import * as gcp from '@pulumi/gcp';
import {region, projectId, apiMaxInstances, databaseUrl, jwtSecret, openaiApiKey, gcsBucketName, allowedOrigins, imageTag} from '../config';
import {apiServiceAccount} from '../iam';
import {enabledApis} from '../apis';

// Cloud Run API service
export const apiService = new gcp.cloudrunv2.Service(
  'core-api',
  {
    name: 'core-api',
    location: region,
    ingress: 'INGRESS_TRAFFIC_ALL',
    template: {
      serviceAccount: apiServiceAccount.email,
      scaling: {
        minInstanceCount: 0,
        maxInstanceCount: apiMaxInstances,
      },
      timeout: '300s', // 5 min for WebSocket
      containers: [
        {
          image: `${region}-docker.pkg.dev/${projectId}/core-api/api:${imageTag}`,
          ports: {containerPort: 3000},
          resources: {
            limits: {
              memory: '512Mi',
              cpu: '1',
            },
            cpuIdle: false, // Keep CPU allocated for WebSocket
          },
          envs: [
            {name: 'NODE_ENV', value: 'production'},
            {name: 'GCP_PROJECT_ID', value: projectId},
            {name: 'DATABASE_URL', value: databaseUrl},
            {name: 'JWT_SECRET', value: jwtSecret},
            {name: 'OPENAI_API_KEY', value: openaiApiKey},
            {name: 'GCS_BUCKET_NAME', value: gcsBucketName},
            {name: 'ALLOWED_ORIGINS', value: allowedOrigins},
          ],
          startupProbe: {
            httpGet: {
              path: '/health',
              port: 3000,
            },
            initialDelaySeconds: 0,
            periodSeconds: 10,
            failureThreshold: 3,
            timeoutSeconds: 5,
          },
          livenessProbe: {
            httpGet: {
              path: '/health',
              port: 3000,
            },
            periodSeconds: 30,
            failureThreshold: 3,
            timeoutSeconds: 5,
          },
        },
      ],
    },
  },
  {dependsOn: enabledApis}
);

// Allow unauthenticated access (public API)
export const apiInvoker = new gcp.cloudrunv2.ServiceIamMember('api-invoker', {
  name: apiService.name,
  location: region,
  role: 'roles/run.invoker',
  member: 'allUsers',
});

// Export the API URL
export const apiUrl = apiService.uri;
