import {FastifyInstance} from 'fastify';
import {generateResponse} from '../../services/storyTeller.ts';
import {
  createStoryRawEvent,
  deleteStoryRaw,
  getOrCreateStoryRaw,
  getStoryRawWithEvents,
  updateStoryRaw,
} from '../../services/storyRaw.ts';
import {StoryRawEventType} from '../../db/schema/storyRawEvent.ts';

const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];

export default async function storyRawChatRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/story-event', {websocket: true}, async (connection, req) => {
    const origin = req.headers.origin || '';
    const {uid, storyId} = req.query as Record<string, string>;

    if (!uid) {
      return connection.socket.close();
    }

    if (!allowedOrigins.includes(origin)) {
      return connection.socket.close();
    }

    const entity = await getOrCreateStoryRaw(uid, storyId);

    if (!entity) {
      return connection.socket.close();
    }

    const {storyRaw: story, events} = entity;
    const history = events.map(({content, type}) => ({content, type}));

    connection.on('message', async (message: Buffer) => {
      const {data} = JSON.parse(message.toString());

      await createStoryRawEvent({
        userId: uid,
        content: data,
        type: StoryRawEventType.User,
        storyRawId: story.id,
      });
      history.push({content: data, type: StoryRawEventType.User});

      const isNewConversation = history.length === 1;
      const response = await generateResponse({history, isNewConversation});

      await createStoryRawEvent({
        userId: uid,
        content: response.content,
        type: StoryRawEventType.Assistant,
        storyRawId: story.id,
      });
      history.push({content: response.content, type: StoryRawEventType.Assistant});

      if (isNewConversation && (response.title || response.tags)) {
        await updateStoryRaw(story.id, uid, {
          title: response.title ?? undefined,
          tags: response.tags ?? undefined,
        });
      }

      connection.send(JSON.stringify(response));
    });

    connection.on('close', async () => {
      const result = await getStoryRawWithEvents(story.id, uid);

      if (!result) {
        return;
      }

      if (history.length > 0) {
        return;
      }

      await deleteStoryRaw(story.id, uid);
    });
  });
}
