import {eq} from 'drizzle-orm';
import {db} from '../db/index.ts';
import OpenAI from 'openai';
import {storyIndexTable} from '../db/schema/storyIndex.ts';
import {Story, storyTable} from '../db/schema/story.ts';

export const fetchEmbedding = async (content: string) => {
  const openai = new OpenAI();

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: content,
  });

  return response.data[0].embedding;
};

export const generateStoryEmbedding = async (id: string, content: string) => {
  if (!content) {
    throw new Error('Story not found');
  }

  const embedding = await fetchEmbedding(content);

  // for now, store 1:1 mapping of content to embedding
  const exists = await db
    .select()
    .from(storyIndexTable)
    .where(eq(storyIndexTable.storyId, id))
    .limit(1);

  if (exists.length > 0) {
    await db
      .update(storyIndexTable)
      .set({chunk: content, vector: embedding})
      .where(eq(storyIndexTable.storyId, id));
  } else {
    await db.insert(storyIndexTable).values({
      storyId: id,
      chunk: content,
      vector: embedding,
      metadata: {},
    });
  }
};

export const summarizeStory = async (story: Story) => {
  if (!story || !story.events || story.events.length < 2) {
    return;
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

  return summary;
};
