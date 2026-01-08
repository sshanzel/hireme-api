import {FastifyInstance} from 'fastify';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async (req, res) => {
    return {status: 'ok'};
  });
}
