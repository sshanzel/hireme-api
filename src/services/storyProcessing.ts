import {eq} from 'drizzle-orm';
import {db} from '../db/index.ts';
import OpenAI from 'openai';
import {storyIndexTable} from '../db/schema/storyIndex.ts';
import {storyTable} from '../db/schema/story.ts';

export const fetchEmbedding = async (content: string) => {
  const openai = new OpenAI();

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: content,
  });

  return response.data[0].embedding;
};

export const generateStoryEmbedding = async (storyId: string) => {
  const story = await db.select().from(storyTable).where(eq(storyTable.id, storyId)).limit(1);

  if (!story[0]?.content) {
    throw new Error('Story not found');
  }

  const content = story[0].content;
  const embedding = await fetchEmbedding(content);

  // for now, store 1:1 mapping of content to embedding
  const exists = await db
    .select()
    .from(storyIndexTable)
    .where(eq(storyIndexTable.storyId, storyId))
    .limit(1);

  if (exists.length > 0) {
    await db
      .update(storyIndexTable)
      .set({vector: embedding})
      .where(eq(storyIndexTable.storyId, storyId));
  } else {
    await db.insert(storyIndexTable).values({
      chunk: content,
      vector: embedding,
      metadata: '{}',
    });
  }
};

export const summarizeStory = async (storyId: string) => {
  const story = await db.query.storyTable.findFirst({
    where: eq(storyTable.id, storyId),
    columns: {
      id: true,
      title: true,
      tags: true,
      createdAt: true,
      updatedAt: true,
    },
    with: {
      events: {
        columns: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!story) {
    throw new Error('Story not found');
  }
};
