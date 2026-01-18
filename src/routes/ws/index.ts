import {FastifyInstance} from 'fastify';
import {generateResponse, generateStoryAgent} from '../../services/storyTeller.ts';
import {run} from '@openai/agents';
import {
  createStoryRawEvent,
  deleteStoryRaw,
  getOrCreateStoryRaw,
  getStoryRawWithEvents,
} from '../../services/storyRaw.ts';
import {StoryRawEventType} from '../../db/schema/storyRawEvent.ts';

interface EventMessage {
  storyId?: string;
  content: string;
  type: 'ugc';
}

const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];

enum MessageType {
  StoryEvent = 'story-event',
  Response = 'response',
}

const initConnection = (userId: string, storyId?: string) => {};

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
    console.log(entity);

    if (!entity) {
      return connection.socket.close();
    }

    const {storyRaw: story, events} = entity;
    const history = events.map(({content, type}) => ({
      content,
      role: type,
    }));

    connection.on('message', async (message: EventMessage) => {
      const {data} = JSON.parse(message.toString());

      await createStoryRawEvent({
        userId: uid,
        content: data,
        type: StoryRawEventType.User,
        storyRawId: story.id,
      });
      history.push({content: data, role: StoryRawEventType.User});

      const response = await generateResponse(history);

      await createStoryRawEvent({
        userId: uid,
        content: response!,
        type: StoryRawEventType.Assistant,
        storyRawId: story.id,
      });
      history.push({content: response!, role: StoryRawEventType.Assistant});

      connection.send(response);
    });

    connection.on('close', async () => {
      const result = await getStoryRawWithEvents(story.id, uid);

      if (!result) {
        return;
      }

      if (result.events.length > 0) {
        return;
      }

      await deleteStoryRaw(story.id, uid);
    });
  });
}
