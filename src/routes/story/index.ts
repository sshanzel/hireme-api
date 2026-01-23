import {FastifyInstance, FastifyReply} from 'fastify';
import {withAuth, AuthenticatedRequest} from '../../utils/auth-helper.ts';
import {getStoriesByUser, deleteStory, updateStory} from '../../services/story.ts';

interface IdParams {
  id: string;
}

interface TagExperienceBody {
  experienceId: string | null;
}

export default async function storyRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/stories',
    withAuth(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const stories = await getStoriesByUser(request.user.id);
      return reply.status(200).send({stories});
    })
  );

  fastify.delete<{Params: IdParams}>(
    '/stories/:id',
    withAuth(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const {id} = request.params as IdParams;
      const deleted = await deleteStory(id, request.user.id);

      if (!deleted) {
        return reply.status(404).send({error: 'Story not found'});
      }

      return reply.status(200).send({message: 'Story deleted successfully'});
    })
  );

  fastify.patch<{Params: IdParams; Body: TagExperienceBody}>(
    '/stories/:id/experience',
    withAuth(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const {id} = request.params as IdParams;
      const {experienceId} = request.body as TagExperienceBody;

      const updated = await updateStory(id, request.user.id, {experienceId});

      if (!updated) {
        return reply.status(404).send({error: 'Story not found'});
      }

      return reply.status(200).send({story: updated});
    })
  );
}
