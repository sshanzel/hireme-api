import 'dotenv/config';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import routes from './routes/index.ts';

const fastify: FastifyInstance = Fastify({
  logger: true,
});

// Register JWT plugin
fastify.register(fastifyJwt, {secret: process.env.JWT_SECRET!});

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
