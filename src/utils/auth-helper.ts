import {FastifyRequest, FastifyReply, RouteHandlerMethod} from 'fastify';
import type {WebSocket} from '@fastify/websocket';

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
  handler: (request: AuthenticatedRequest, reply: FastifyReply) => Promise<unknown>
): RouteHandlerMethod {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const authenticatedRequest = request as AuthenticatedRequest;
      return handler(authenticatedRequest, reply);
    } catch {
      reply.code(401).send({error: 'Unauthorized'});
    }
  };
}

/**
 * Verifies JWT from cookies or query param and returns authenticated user for WebSocket handlers.
 * Closes socket with 4001 if unauthorized.
 */
export async function getSocketUser(
  req: FastifyRequest,
  socket: WebSocket,
): Promise<AuthenticatedUser | null> {
  try {
    await req.jwtVerify();
    return req.user as AuthenticatedUser;
  } catch {
    const {token} = req.query as {token?: string};

    if (!token) {
      socket.close(4001, 'Unauthorized');
      return null;
    }

    try {
      const decoded = req.server.jwt.verify<AuthenticatedUser>(token);
      return decoded;
    } catch {
      socket.close(4001, 'Unauthorized');
      return null;
    }
  }
}
