import 'dotenv/config';
import {registerSubscriptions} from './subscriptions/index.ts';

async function main() {
  console.log('Starting worker...');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  if (process.env.PUBSUB_EMULATOR_HOST) {
    console.log(`Using Pub/Sub emulator: ${process.env.PUBSUB_EMULATOR_HOST}`);
  }

  await registerSubscriptions();

  console.log('Worker started. Listening for messages...');

  // Keep the process alive
  process.on('SIGINT', () => {
    console.log('Shutting down worker...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('Shutting down worker...');
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Worker failed to start:', error);
  process.exit(1);
});
