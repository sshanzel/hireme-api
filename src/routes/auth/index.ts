import fastify, {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import {authenticateUser, createUser, getUserByEmail} from '../../services/auth.ts';
import {withAuth} from '../../utils/auth-helper.ts';
import {User} from '../../db/schema/user.ts';

interface LoginBody {
  email: string;
  password: string;
}

interface SignupBody {
  email: string;
  password: string;
  name: string;
}

const getSignPayload = (user: User) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  cvUploadedAt: user.cvUploadedAt,
});

export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{Body: LoginBody}>(
    '/login',
    async (request: FastifyRequest<{Body: LoginBody}>, reply: FastifyReply) => {
      const {email, password} = request.body;

      if (!email || !password) {
        return reply.status(400).send({error: 'Email and password are required'});
      }

      const user = await authenticateUser(email, password);

      if (!user) {
        return reply.status(401).send({error: 'Invalid email or password'});
      }

      const token = fastify.jwt.sign(getSignPayload(user));

      return reply.status(200).send({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          cvUploadedAt: user.cvUploadedAt,
        },
      });
    }
  );

  fastify.post<{Body: SignupBody}>(
    '/signup',
    async (request: FastifyRequest<{Body: SignupBody}>, reply: FastifyReply) => {
      const {email, password, name} = request.body;

      if (!email || !password) {
        return reply.status(400).send({error: 'Email and password are required'});
      }

      if (password.length < 6) {
        return reply.status(400).send({error: 'Password must be at least 6 characters'});
      }

      const existingUser = await getUserByEmail(email);

      if (existingUser) {
        return reply.status(409).send({error: 'User with this email already exists'});
      }

      const newUser = await createUser(email, password, name);

      const token = fastify.jwt.sign(getSignPayload(newUser));

      return reply.status(201).send({
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          cvUploadedAt: newUser.cvUploadedAt,
        },
      });
    }
  );

  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    // With JWT, logout is typically handled on the client-side by deleting the token
    // This endpoint can be used for additional cleanup if needed (e.g., token blacklisting)
    return reply.status(200).send({message: 'Logged out successfully'});
  });

  // Protected route example - get current user
  fastify.get(
    '/me',
    withAuth(async (request, reply) => {
      return reply.status(200).send({
        id: request.user.id,
        email: request.user.email,
        name: request.user.name,
      });
    })
  );
}
