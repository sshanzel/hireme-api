import {FastifyInstance, FastifyReply} from 'fastify';
import {z} from 'zod';
import {withAuth, AuthenticatedRequest} from '../../utils/auth-helper.ts';
import {
  createExperience,
  getExperiencesByUser,
  updateExperience,
  deleteExperience,
} from '../../services/experience.ts';
import {ExperienceType} from '../../db/schema/experience.ts';

const experienceTypeSchema = z.nativeEnum(ExperienceType);

const createExperienceSchema = z.object({
  type: experienceTypeSchema,
  title: z.string().min(1),
  organization: z.string().optional(),
  startDate: z.string().datetime({offset: true}).or(z.string().date()),
  endDate: z.string().datetime({offset: true}).or(z.string().date()).optional(),
  description: z.string().optional(),
  skills: z.array(z.string()).optional(),
});

const updateExperienceSchema = z.object({
  type: experienceTypeSchema.optional(),
  title: z.string().min(1).optional(),
  organization: z.string().nullable().optional(),
  startDate: z.string().datetime({offset: true}).or(z.string().date()).optional(),
  endDate: z.string().datetime({offset: true}).or(z.string().date()).nullable().optional(),
  description: z.string().nullable().optional(),
  skills: z.array(z.string()).nullable().optional(),
});

interface IdParams {
  id: string;
}

export default async function experiencesRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/',
    withAuth(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const experiences = await getExperiencesByUser(request.user.id);
      return reply.status(200).send({experiences});
    })
  );

  fastify.post(
    '/',
    withAuth(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const result = createExperienceSchema.safeParse(request.body);

      if (!result.success) {
        return reply.status(400).send({error: result.error.flatten()});
      }

      const body = result.data;
      const experience = await createExperience(request.user.id, {
        type: body.type,
        title: body.title,
        organization: body.organization,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        description: body.description,
        skills: body.skills,
      });

      return reply.status(201).send({experience});
    })
  );

  fastify.patch<{Params: IdParams}>(
    '/:id',
    withAuth(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const {id} = request.params as IdParams;
      const result = updateExperienceSchema.safeParse(request.body);

      if (!result.success) {
        return reply.status(400).send({error: result.error.flatten()});
      }

      const body = result.data;
      const updated = await updateExperience(id, request.user.id, {
        type: body.type,
        title: body.title,
        organization: body.organization,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate === null ? null : body.endDate ? new Date(body.endDate) : undefined,
        description: body.description,
        skills: body.skills,
      });

      if (!updated) {
        return reply.status(404).send({error: 'Experience not found'});
      }

      return reply.status(200).send({experience: updated});
    })
  );

  fastify.delete<{Params: IdParams}>(
    '/:id',
    withAuth(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const {id} = request.params as IdParams;
      const deleted = await deleteExperience(id, request.user.id);

      if (!deleted) {
        return reply.status(404).send({error: 'Experience not found'});
      }

      return reply.status(200).send({message: 'Experience deleted successfully'});
    })
  );
}
