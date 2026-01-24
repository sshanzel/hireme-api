import {FastifyInstance, FastifyReply} from 'fastify';
import {withAuth, AuthenticatedRequest} from '../../utils/auth-helper.ts';
import {getCoachingSessionsByUser, deleteCoaching} from '../../services/coaching.ts';

interface IdParams {
  id: string;
}

export default async function coachingRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/',
    withAuth(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const sessions = await getCoachingSessionsByUser(request.user.id);
      return reply.status(200).send(sessions);
    }),
  );

  fastify.delete<{Params: IdParams}>(
    '/:id',
    withAuth(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const {id} = request.params as IdParams;
      const deleted = await deleteCoaching(id, request.user.id);

      if (!deleted) {
        return reply.status(404).send({error: 'Coaching session not found'});
      }

      return reply.status(200).send({message: 'Coaching session deleted'});
    }),
  );
}
