import type {SubscriptionConfig} from './types.ts';
import {summarizeStory, generateStoryEmbedding} from '../services/storyProcessing.ts';
import {eq} from 'drizzle-orm';
import {db} from '../db/index.ts';
import {storyTable} from '../db/schema/story.ts';

interface StoryCanonicalizationEvent {
  storyId: string;
  version: number;
}

export const storyCanonicalizationSubscription: SubscriptionConfig<StoryCanonicalizationEvent> = {
  topic: 'api.v1.story-completed',
  subscription: 'api.v1.story-completed-canonicalization',
  handler: async (data): Promise<void> => {
    console.log(`Canonicalizing story: ${data.storyId}`);

    const story = await db.query.storyTable.findFirst({
      where: eq(storyTable.id, data.storyId),
      with: {events: true},
    });

    if (!story || story.events.length < 2) {
      console.log(`Story not found: ${data.storyId}`);
      return;
    }

    if (story.canonicalizedVersion > data.version) {
      console.log(`Story already canonicalized: ${data.storyId}`);

      return;
    }

    const summary = await (story.canonicalizedVersion > data.version
      ? Promise.resolve(story.content)
      : summarizeStory(story));

    if (!summary) {
      console.log(`No summary generated for story: ${data.storyId}`);
      return;
    }

    await db
      .update(storyTable)
      .set({content: summary, canonicalizedVersion: story.canonicalizedVersion + 1})
      .where(eq(storyTable.id, data.storyId));

    console.log(`Story canonicalized: ${data.storyId}`);

    await generateStoryEmbedding(data.storyId, summary);
    console.log(`Embedding generated for story: ${data.storyId}`);
  },
};
