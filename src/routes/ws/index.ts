import {FastifyInstance} from 'fastify';
import type {HeartbeatSocket} from '../../types/websocket.ts';
import {StoryChatSession} from '../../services/storyChat.ts';

const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];

export default async function storyChatRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/story-event', {websocket: true}, async (connection, req) => {
    const origin = req.headers.origin || '';
    const {uid, storyId} = req.query as Record<string, string>;

    const socket = connection as HeartbeatSocket;

    if (!uid) {
      return socket.close(4001, 'Missing user id');
    }

    if (allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
      return socket.close(4003, 'Origin not allowed');
    }

    let session: StoryChatSession | null;

    try {
      session = await StoryChatSession.create(socket, uid, storyId);

      if (!session) {
        return socket.close(4004, 'Story not found');
      }
    } catch (err) {
      console.error('Failed to initialize session:', err);
      return socket.close(4002, 'Failed to initialize story');
    }

    session.sendConnected();

    socket.isAlive = true;
    socket.on('pong', () => {
      socket.isAlive = true;
    });

    socket.on('message', async (rawMessage: Buffer) => {
      socket.isAlive = true;
      await session.handleMessage(rawMessage.toString());
    });

    socket.on('error', (err: Error) => {
      console.error('WebSocket error:', err);
    });

    socket.on('close', async () => {
      try {
        await session.cleanup();
      } catch (err) {
        console.error('Failed to cleanup session:', err);
      }
    });
  });
}
