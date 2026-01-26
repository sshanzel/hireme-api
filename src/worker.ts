import 'dotenv/config';
import Fastify from 'fastify';
import {registerSubscriptions} from './subscriptions/index.ts';
import {cvUploadParsingSubscription} from './subscriptions/cvUploadParsing.ts';
import {storyCanonicalizationSubscription} from './subscriptions/storyCanonicalization.ts';
import {experienceIndexingSubscription} from './subscriptions/experienceIndexing.ts';

// Detect if running in Cloud Run
const isCloudRun = process.env.K_SERVICE !== undefined;

// Kill switch - set WORKER_DISABLED=true to stop processing
const isWorkerDisabled = () => process.env.WORKER_DISABLED === 'true';

interface PubSubPushMessage {
  message: {
    data: string; // base64 encoded
    messageId: string;
    publishTime: string;
    attributes?: Record<string, string>;
  };
  subscription: string;
}

async function startHttpServer() {
  const app = Fastify({logger: true});

  // Health check
  app.get('/', async () => ({status: 'ok'}));

  // CV uploaded event handler
  app.post('/events/cv-uploaded', async (request, reply) => {
    if (isWorkerDisabled()) {
      console.log('[Kill Switch] Worker disabled, skipping cv-uploaded');
      return reply.status(200).send('Disabled');
    }

    const body = request.body as PubSubPushMessage;
    const data = JSON.parse(Buffer.from(body.message.data, 'base64').toString());

    console.log(`[Push] Processing cv-uploaded: ${body.message.messageId}`);

    try {
      await cvUploadParsingSubscription.handler(data);
      return reply.status(200).send('OK');
    } catch (error) {
      console.error('Failed to process cv-uploaded:', error);
      return reply.status(500).send('Failed');
    }
  });

  // Story completed event handler
  app.post('/events/story-completed', async (request, reply) => {
    if (isWorkerDisabled()) {
      console.log('[Kill Switch] Worker disabled, skipping story-completed');
      return reply.status(200).send('Disabled');
    }

    const body = request.body as PubSubPushMessage;
    const data = JSON.parse(Buffer.from(body.message.data, 'base64').toString());

    console.log(`[Push] Processing story-completed: ${body.message.messageId}`);

    try {
      await storyCanonicalizationSubscription.handler(data);
      return reply.status(200).send('OK');
    } catch (error) {
      console.error('Failed to process story-completed:', error);
      return reply.status(500).send('Failed');
    }
  });

  // Experience updated event handler
  app.post('/events/experience-updated', async (request, reply) => {
    if (isWorkerDisabled()) {
      console.log('[Kill Switch] Worker disabled, skipping experience-updated');
      return reply.status(200).send('Disabled');
    }

    const body = request.body as PubSubPushMessage;
    const data = JSON.parse(Buffer.from(body.message.data, 'base64').toString());

    console.log(`[Push] Processing experience-updated: ${body.message.messageId}`);

    try {
      await experienceIndexingSubscription.handler(data);
      return reply.status(200).send('OK');
    } catch (error) {
      console.error('Failed to process experience-updated:', error);
      return reply.status(500).send('Failed');
    }
  });

  const port = parseInt(process.env.PORT || '8080');
  await app.listen({port, host: '0.0.0.0'});
  console.log(`Worker HTTP server listening on port ${port}`);
}

async function startPullSubscriber() {
  console.log('Starting worker in pull mode...');

  if (process.env.PUBSUB_EMULATOR_HOST) {
    console.log(`Using Pub/Sub emulator: ${process.env.PUBSUB_EMULATOR_HOST}`);
  }

  await registerSubscriptions();
  console.log('Worker started. Listening for messages...');
}

async function main() {
  console.log('Starting worker...');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Mode: ${isCloudRun ? 'Cloud Run (HTTP push)' : 'Local (pull)'}`);

  if (isCloudRun) {
    await startHttpServer();
  } else {
    await startPullSubscriber();
  }

  // Graceful shutdown
  const shutdown = () => {
    console.log('Shutting down worker...');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(error => {
  console.error('Worker failed to start:', error);
  process.exit(1);
});
