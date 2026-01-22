import {FastifyInstance} from 'fastify';
import authRoutes from './auth/index.ts';
import cvRoutes from './cv/index.ts';
import documentRoutes from './documents/index.ts';
import storyRawRoutes from './story-raw/index.ts';
import profileRoutes from './profile/index.ts';
import experiencesRoutes from './experiences/index.ts';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async (req, res) => {
    return {status: 'ok'};
  });

  fastify.register(authRoutes, {prefix: '/auth'});
  fastify.register(cvRoutes, {prefix: '/cv'});
  fastify.register(documentRoutes, {prefix: '/documents'});
  fastify.register(storyRawRoutes, {prefix: '/story-raw'});
  fastify.register(profileRoutes, {prefix: '/profile'});
  fastify.register(experiencesRoutes, {prefix: '/experiences'});
}
