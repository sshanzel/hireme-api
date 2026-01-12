import {FastifyInstance} from 'fastify';
import authRoutes from './auth/index.ts';
import documentRoutes from './documents/index.ts';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async (req, res) => {
    return {status: 'ok'};
  });

  fastify.register(authRoutes, {prefix: '/auth'});
  fastify.register(documentRoutes, {prefix: '/documents'});
}
