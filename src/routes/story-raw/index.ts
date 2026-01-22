import {FastifyInstance, FastifyReply} from 'fastify';
import {withAuth, AuthenticatedRequest} from '../../utils/auth-helper.ts';
import {getStoryRawsByUser, deleteStoryRaw, updateStoryRaw} from '../../services/storyRaw.ts';

interface IdParams {
  id: string;
}

interface TagExperienceBody {
  experienceId: string | null;
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

  fastify.patch<{Params: IdParams; Body: TagExperienceBody}>(
    '/story-raws/:id/experience',
    withAuth(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const {id} = request.params as IdParams;
      const {experienceId} = request.body as TagExperienceBody;

      const updated = await updateStoryRaw(id, request.user.id, {experienceId});

      if (!updated) {
        return reply.status(404).send({error: 'StoryRaw not found'});
      }

      return reply.status(200).send({storyRaw: updated});
    })
  );
}
