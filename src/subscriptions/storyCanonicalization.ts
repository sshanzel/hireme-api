import type {SubscriptionConfig} from './types.ts';
import {summarizeStory, generateStoryEmbedding} from '../services/storyProcessing.ts';

interface StoryCanonicalizationEvent {
  storyId: string;
}

export const storyCanonicalizationSubscription: SubscriptionConfig<StoryCanonicalizationEvent> = {
  topic: 'api.v1.story-completed',
  subscription: 'api.v1.story-completed-canonicalization',
  handler: async (data): Promise<void> => {
    console.log(`Canonicalizing story: ${data.storyId}`);

    await summarizeStory(data.storyId);
    console.log(`Story canonicalized: ${data.storyId}`);

    await generateStoryEmbedding(data.storyId);
    console.log(`Embedding generated for story: ${data.storyId}`);
  },
};
