import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import {z} from 'zod';
import {withAuth, AuthenticatedRequest} from '../../utils/auth-helper.ts';
import {getFullProfile, getPublicProfile, updateProfile} from '../../services/profile.ts';

interface PublicProfileParams {
  identifier: string;
}

const updateProfileSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/).optional(),
  name: z.string().min(1).optional(),
  headline: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  githubUrl: z.url().nullable().optional(),
  linkedinUrl: z.url().nullable().optional(),
  websiteUrl: z.url().nullable().optional(),
  twitterUrl: z.url().nullable().optional(),
});

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

  fastify.patch(
    '/',
    withAuth(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const result = updateProfileSchema.safeParse(request.body);

      if (!result.success) {
        return reply.status(400).send({error: result.error.flatten()});
      }

      const updated = await updateProfile(request.user.id, result.data);

      if (!updated) {
        return reply.status(404).send({error: 'Profile not found'});
      }

      return reply.status(200).send({user: updated});
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
