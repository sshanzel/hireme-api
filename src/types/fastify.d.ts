import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

declare global {
  namespace FastifyJWT {
    interface Payload {
      id: string;
      email: string;
      name: string;
    }
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user: {
      id: string;
      email: string;
      name: string;
    };
  }
}
