import {FastifyInstance} from 'fastify';
import type {HeartbeatSocket} from '../../types/websocket.ts';
import {StoryChatSession} from '../../services/story/storyChat.ts';
import {CoachChatSession} from '../../services/coaching/coachChat.ts';
import {BioChatSession} from '../../services/bio/bioChat.ts';
import {getSocketUser} from '../../utils/auth-helper.ts';

const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];

export default async function websocketRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/story-event', {websocket: true}, async (connection, req) => {
    const origin = req.headers.origin || '';
    const {storyId} = req.query as Record<string, string>;

    const socket = connection as HeartbeatSocket;

    const user = await getSocketUser(req, socket);

    if (!user) return;

    if (allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
      return socket.close(4003, 'Origin not allowed');
    }

    let session: StoryChatSession | null;

    try {
      session = await StoryChatSession.create(socket, user.id, storyId);

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

  fastify.get('/coach', {websocket: true}, async (connection, req) => {
    const origin = req.headers.origin || '';
    const {coachingId} = req.query as Record<string, string>;

    const socket = connection as HeartbeatSocket;

    const user = await getSocketUser(req, socket);

    if (!user) return;

    if (allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
      return socket.close(4003, 'Origin not allowed');
    }

    let session: CoachChatSession | null;

    try {
      session = await CoachChatSession.create(socket, user.id, coachingId);

      if (!session) {
        return socket.close(4004, 'Coaching session not found');
      }
    } catch (err) {
      console.error('Failed to initialize coaching session:', err);
      return socket.close(4002, 'Failed to initialize coaching');
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
        console.error('Failed to cleanup coaching session:', err);
      }
    });
  });

  fastify.get('/bio/:id', {websocket: true}, async (connection, req) => {
    const origin = req.headers.origin || '';
    const {id} = req.params as {id: string};
    const visitorIp = req.ip;

    const socket = connection as HeartbeatSocket;

    if (!id) {
      return socket.close(4001, 'Missing user id');
    }

    if (allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
      return socket.close(4003, 'Origin not allowed');
    }

    let session: BioChatSession | null;

    try {
      session = await BioChatSession.create(socket, id, visitorIp, origin);

      if (!session) {
        return socket.close(4004, 'User not found');
      }
    } catch (err) {
      console.error('Failed to initialize bio chat session:', err);
      return socket.close(4002, 'Failed to initialize session');
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
        console.error('Failed to cleanup bio chat session:', err);
      }
    });
  });
}
