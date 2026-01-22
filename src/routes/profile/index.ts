import {FastifyInstance, FastifyReply} from 'fastify';
import {withAuth, AuthenticatedRequest} from '../../utils/auth-helper.ts';
import {getFullProfile} from '../../services/profile.ts';

export default async function profileRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/',
    withAuth(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const profile = await getFullProfile(request.user.id);

      if (!profile) {
        return reply.status(404).send({error: 'Profile not found'});
      }

      return reply.status(200).send(profile);
    })
  );
}
