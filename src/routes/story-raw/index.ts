import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import {withAuth, AuthenticatedRequest} from '../../utils/auth-helper.ts';
import {StoryRawEventType} from '../../db/schema/index.ts';
import {
  getStoryRawsByUser,
  getStoryRawWithEvents,
  updateStoryRaw,
  createStoryRawEvent,
  updateStoryRawEvent,
  deleteStoryRawEvent,
} from '../../services/storyRaw.ts';

interface CreateEventBody {
  content: string;
  type: StoryRawEventType;
  storyRawId?: string;
  experienceId?: string;
}

interface UpdateStoryRawBody {
  title: string;
}

interface UpdateEventBody {
  content: string;
}

interface IdParams {
  id: string;
}

export default async function storyRawRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /story-raws - List all user's storyRaws
  fastify.get(
    '/story-raws',
    withAuth(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const storyRaws = await getStoryRawsByUser(request.user.id);
      return reply.status(200).send({storyRaws});
    })
  );

  // GET /story-raws/:id - Get a storyRaw with its events
  fastify.get<{Params: IdParams}>(
    '/story-raws/:id',
    withAuth(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const {id} = request.params as IdParams;
      const result = await getStoryRawWithEvents(id, request.user.id);

      if (!result) {
        return reply.status(404).send({error: 'StoryRaw not found'});
      }

      return reply.status(200).send(result);
    })
  );

  // PATCH /story-raws/:id - Update storyRaw title
  fastify.patch<{Params: IdParams; Body: UpdateStoryRawBody}>(
    '/story-raws/:id',
    withAuth(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const {id} = request.params as IdParams;
      const {title} = request.body as UpdateStoryRawBody;

      if (!title) {
        return reply.status(400).send({error: 'Title is required'});
      }

      const updated = await updateStoryRaw(id, request.user.id, {title});

      if (!updated) {
        return reply.status(404).send({error: 'StoryRaw not found'});
      }

      return reply.status(200).send({storyRaw: updated});
    })
  );

  // PATCH /story-raw-events/:id - Update event content
  fastify.patch<{Params: IdParams; Body: UpdateEventBody}>(
    '/story-raw-events/:id',
    withAuth(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const {id} = request.params as IdParams;
      const {content} = request.body as UpdateEventBody;

      if (!content) {
        return reply.status(400).send({error: 'Content is required'});
      }

      const updated = await updateStoryRawEvent(id, request.user.id, content);

      if (!updated) {
        return reply.status(404).send({error: 'Event not found or access denied'});
      }

      return reply.status(200).send({event: updated});
    })
  );

  // DELETE /story-raw-events/:id - Delete an event
  fastify.delete<{Params: IdParams}>(
    '/story-raw-events/:id',
    withAuth(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const {id} = request.params as IdParams;
      const deleted = await deleteStoryRawEvent(id, request.user.id);

      if (!deleted) {
        return reply.status(404).send({error: 'Event not found or access denied'});
      }

      return reply.status(200).send({message: 'Event deleted successfully'});
    })
  );
}
