import {FastifyInstance, FastifyReply} from 'fastify';
import {withAuth, AuthenticatedRequest} from '../../utils/auth-helper.ts';
import {getStoryRawsByUser, deleteStoryRaw} from '../../services/storyRaw.ts';

interface IdParams {
  id: string;
}

export default async function storyRawRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/story-raws',
    withAuth(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const storyRaws = await getStoryRawsByUser(request.user.id);
      return reply.status(200).send({storyRaws});
    })
  );

  fastify.delete<{Params: IdParams}>(
    '/story-raws/:id',
    withAuth(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const {id} = request.params as IdParams;
      const deleted = await deleteStoryRaw(id, request.user.id);

      if (!deleted) {
        return reply.status(404).send({error: 'StoryRaw not found'});
      }

      return reply.status(200).send({message: 'StoryRaw deleted successfully'});
    })
  );
}
