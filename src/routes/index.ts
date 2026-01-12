import {FastifyInstance} from 'fastify';
import documentRoutes from './documents/index.ts';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async (req, res) => {
    return {status: 'ok'};
  });

  fastify.register(documentRoutes, {prefix: '/documents'});
}
