import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import {withAuth, AuthenticatedRequest} from '../../utils/auth-helper.ts';
import {getFullProfile, getPublicProfile} from '../../services/profile.ts';

interface PublicProfileParams {
  identifier: string;
}

export default async function profileRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/',
    withAuth(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const profile = await getFullProfile(request.user.id);

      if (!profile) {
        return reply.status(404).send({error: 'Profile not found'});
      }

      return reply.status(200).send(profile);
    }),
  );

  fastify.get<{Params: PublicProfileParams}>(
    '/public/:identifier',
    async (request: FastifyRequest<{Params: PublicProfileParams}>, reply: FastifyReply) => {
      const {identifier} = request.params;

      const profile = await getPublicProfile(identifier);

      if (!profile) {
        return reply.status(404).send({error: 'Profile not found'});
      }

      return reply.status(200).send(profile);
    },
  );
}
