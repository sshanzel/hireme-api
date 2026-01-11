import 'dotenv/config';
import Fastify from 'fastify';
import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import routes from './routes/index.ts';

const fastify: FastifyInstance = Fastify({
  logger: true,
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
