import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
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

const TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

const getSignPayload = (user: User) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  cvUploadedAt: user.cvUploadedAt,
});

const setAuthCookie = (reply: FastifyReply, token: string) => {
  reply.setCookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: TOKEN_MAX_AGE,
  });
};

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

      const token = fastify.jwt.sign(getSignPayload(user), {expiresIn: TOKEN_MAX_AGE});
      setAuthCookie(reply, token);

      return reply.status(200).send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          cvUploadedAt: user.cvUploadedAt,
        },
      });
    },
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

      const token = fastify.jwt.sign(getSignPayload(newUser), {expiresIn: TOKEN_MAX_AGE});
      setAuthCookie(reply, token);

      return reply.status(201).send({
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          cvUploadedAt: newUser.cvUploadedAt,
        },
      });
    },
  );

  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.clearCookie('token', {path: '/'});
    return reply.status(200).send({message: 'Logged out successfully'});
  });

  // Protected route example - get current user
  fastify.get(
    '/me',
    withAuth(async (request, reply) => {
      const user = await getUserByEmail(request.user.email);

      if (!user) {
        return reply.status(404).send({error: 'User not found'});
      }

      return reply.status(200).send({
        id: user.id,
        email: user.email,
        name: user.name,
        cvUploadedAt: user.cvUploadedAt,
      });
    })
  );
}
