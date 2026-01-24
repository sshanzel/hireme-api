import type {SubscriptionConfig} from './types.ts';
import {generateExperienceEmbedding} from '../services/experience/experienceProcessing.ts';

interface ExperienceIndexingEvent {
  experienceId: string;
}

export const experienceIndexingSubscription: SubscriptionConfig<ExperienceIndexingEvent> = {
  topic: 'api.v1.experience-updated',
  subscription: 'api.v1.experience-updated-indexing',
  handler: async (data): Promise<void> => {
    console.log(`Indexing experience: ${data.experienceId}`);

    try {
      await generateExperienceEmbedding(data.experienceId);
      console.log(`Experience indexed: ${data.experienceId}`);
    } catch (err) {
      console.error(`Failed to index experience ${data.experienceId}:`, err);
      throw err;
    }
  },
};
