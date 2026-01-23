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
      .set({chunk: content, vector: embedding})
      .where(eq(storyIndexTable.storyId, storyId));
  } else {
    await db.insert(storyIndexTable).values({
      storyId,
      chunk: content,
      vector: embedding,
      metadata: {},
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

  // send the events to OpenAI for summarization
  // it must be optimized to fit a chunk of vector embeddings
  const openai = new OpenAI();
  const messages = story.events.map(e => ({
    role: e.role === 'user' ? 'user' : 'assistant',
    content: e.content,
  }));

  const summaryPrompt = `
    Summarize the following conversation between a user and an AI assistant so that the result can optimally fit into a vector database for retrieval.
    The summary should capture the key points, topics discussed, and any important details that would help in understanding the context of the conversation.
    Convert this conversation into a clear, first-person narrative about a professional experience. Remove filler words and structure it coherently.
    Each exchange is separated by \`=======\` while the user is the one starting the conversation.
  `;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {role: 'system', content: summaryPrompt},
      {
        role: 'user',
        content: messages.map(m => m.content).join('\n=======\n'),
      },
    ],
  });

  const summary = response.choices[0].message.content?.trim();

  // update the story content with the summary
  await db
    .update(storyTable)
    .set({content: summary, updatedAt: new Date()})
    .where(eq(storyTable.id, storyId));

  return summary;
};
