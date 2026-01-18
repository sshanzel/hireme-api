import {FastifyInstance} from 'fastify';
import {generateStoryAgent} from '../../services/storyTeller.ts';
import {run} from '@openai/agents';

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
  fastify.get('/story-event', {websocket: true}, (connection, req) => {
    const origin = req.headers.origin || '';
    const query = req.query as Record<string, string>;

    if (!query.uid) {
      return connection.socket.close();
    }

    if (!allowedOrigins.includes(origin)) {
      return connection.socket.close();
    }

    const storyTeller = generateStoryAgent();

    connection.on('message', async (message: EventMessage) => {
      const parsed = JSON.parse(message.toString());
      console.log('Received message:', parsed);
      const result = await run(storyTeller, parsed.data, {context: {uid: query.uid}});
      const response = JSON.stringify({
        type: MessageType.Response,
        data: result.finalOutput,
      });
      console.log('result.output:', result.output);
      console.log('result.finalOutput:', result.finalOutput);
      connection.send(response);
    });
  });
}
