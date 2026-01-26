import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyMultipart from '@fastify/multipart';
import fastifyRateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import type {HeartbeatSocket} from './types/websocket.ts';
import routes from './routes/index.ts';
import sockets from './routes/ws/index.ts';

// Validate critical environment variables
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const fastify: FastifyInstance = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
      level(label) {
        // Map pino levels to GCP severity for Cloud Logging
        const severityMap: Record<string, string> = {
          trace: 'DEBUG',
          debug: 'DEBUG',
          info: 'INFO',
          warn: 'WARNING',
          error: 'ERROR',
          fatal: 'CRITICAL',
        };
        return {severity: severityMap[label] || 'DEFAULT'};
      },
    },
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: request.url,
          hostname: request.hostname,
          remoteAddress: request.ip,
        };
      },
      res(reply) {
        return {
          statusCode: reply.statusCode,
        };
      },
    },
  },
  trustProxy: true, // Required for rate limiting behind Cloud Run proxy
});

// Register CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
fastify.register(fastifyCors, {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
});

// Register global rate limiting
fastify.register(fastifyRateLimit, {
  max: 100, // 100 requests per minute globally
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please slow down.',
  }),
});

// Register cookie plugin
fastify.register(fastifyCookie);

// Register JWT plugin with cookie support
fastify.register(fastifyJwt, {
  secret: process.env.JWT_SECRET!,
  cookie: {
    cookieName: 'token',
    signed: false,
  },
});

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

// Custom error handler to expose raw database errors in development
fastify.setErrorHandler(
  (error: Record<string, unknown>, request: FastifyRequest, reply: FastifyReply) => {
    const isDev = process.env.NODE_ENV !== 'production';

    // Extract the root cause for database errors
    const rootCause = error.cause as Error | undefined;

    fastify.log.error({
      message: error.message,
      cause: rootCause?.message,
      stack: isDev ? error.stack : undefined,
      request: {
        method: request.method,
        url: request.url,
        userId: (request.user as {id?: string})?.id,
      },
    });

    reply.status(500).send({
      error: 'Internal Server Error',
      message: isDev ? error.message : undefined,
      cause: isDev ? rootCause?.message : undefined,
    });
  },
);

fastify.register(routes);

await fastify.register(websocket, {options: {maxPayload: 1048576}});

// Heartbeat interval to detect dead connections
const HEARTBEAT_INTERVAL = 30000;
let heartbeatInterval: NodeJS.Timeout | null = null;

fastify.ready().then(() => {
  const wss = fastify.websocketServer;

  heartbeatInterval = setInterval(() => {
    wss.clients.forEach(client => {
      const socket = client as HeartbeatSocket;
      if (socket.isAlive === false) {
        return socket.terminate();
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, HEARTBEAT_INTERVAL);

  wss.on('close', () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
  });
});

const shutdown = async () => {
  fastify.log.info('Shutting down...');
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  await fastify.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGHUP', shutdown);

fastify.register(sockets, {prefix: '/ws'});

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    await fastify.listen({port, host: '0.0.0.0'});
    console.log(`Server running at http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
