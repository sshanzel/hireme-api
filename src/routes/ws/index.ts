import {FastifyInstance} from 'fastify';
import {StoryChatSession} from '../../services/storyChat.ts';

const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];

export default async function storyRawChatRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/story-event', {websocket: true}, async (connection, req) => {
    const origin = req.headers.origin || '';
    const {uid, storyId} = req.query as Record<string, string>;

    if (!uid) {
      return connection.socket.close(4001, 'Missing user id');
    }

    if (allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
      return connection.socket.close(4003, 'Origin not allowed');
    }

    let session: StoryChatSession;
    try {
      const result = await StoryChatSession.create(connection, uid, storyId);
      if (!result) {
        return connection.socket.close(4004, 'Story not found');
      }
      session = result;
    } catch (err) {
      console.error('Failed to initialize session:', err);
      return connection.socket.close(4002, 'Failed to initialize story');
    }

    session.sendConnected();

    connection.on('message', async (rawMessage: Buffer) => {
      await session.handleMessage(rawMessage.toString());
    });

    connection.on('error', (err: Error) => {
      console.error('WebSocket error:', err);
    });

    connection.on('close', async () => {
      try {
        await session.cleanup();
      } catch (err) {
        console.error('Failed to cleanup session:', err);
      }
    });
  });
}
