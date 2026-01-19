import {FastifyRequest, FastifyReply, RouteHandlerMethod} from 'fastify';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: AuthenticatedUser;
}

/**
 * Wraps a route handler to require authentication with proper type inference
 */
export function withAuth(
  handler: (request: AuthenticatedRequest, reply: FastifyReply) => Promise<any>
): RouteHandlerMethod {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const authenticatedRequest = request as AuthenticatedRequest;
      return handler(authenticatedRequest, reply);
    } catch (err) {
      reply.code(401).send({error: 'Unauthorized'});
    }
  };
}
