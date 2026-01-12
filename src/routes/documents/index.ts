import {FastifyInstance} from 'fastify';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/init', async (req, res) => {
    // upload here
    return {status: 'ok'};
  });
}
