import 'dotenv/config';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyMultipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import type {HeartbeatSocket} from './types/websocket.ts';
import routes from './routes/index.ts';
import sockets from './routes/ws/index.ts';

const fastify: FastifyInstance = Fastify({
  logger: true,
});

// Register JWT plugin
fastify.register(fastifyJwt, {secret: process.env.JWT_SECRET!});

// Register multipart for file uploads
fastify.register(fastifyMultipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Decorate fastify with authenticate function
fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const payload = request.user as {id: string; email: string};
    request.user = payload;
  } catch (err) {
    reply.code(401).send({error: 'Unauthorized'});
  }
});

fastify.register(routes);

await fastify.register(websocket, {options: {maxPayload: 1048576}});

// Heartbeat interval to detect dead connections
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

fastify.ready().then(() => {
  const wss = fastify.websocketServer;

  const heartbeat = setInterval(() => {
    wss.clients.forEach((client) => {
      const socket = client as HeartbeatSocket;
      if (socket.isAlive === false) {
        return socket.terminate();
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, HEARTBEAT_INTERVAL);

  wss.on('close', () => {
    clearInterval(heartbeat);
  });
});

fastify.register(sockets, {prefix: '/ws'});

const start = async () => {
  try {
    await fastify.listen({port: Number(process.env.PORT), host: '0.0.0.0'});
    console.log(`Server running at http://localhost:${process.env.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
