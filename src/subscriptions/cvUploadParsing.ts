import type {SubscriptionConfig} from './types.ts';

interface ExampleEvent {
  fileId: string;
}

export const cvUploadParsingSubscription: SubscriptionConfig<ExampleEvent> = {
  topic: 'api.v1.cv-uploaded',
  subscription: 'api.v1.cv-uploaded-parsing',
  handler: async (data): Promise<void> => {
    console.log(`Processing example event: ${data.fileId}`);
  },
};
