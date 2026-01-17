import {FastifyInstance} from 'fastify';

interface EventMessage {
  storyId?: string;
  content: string;
  type: 'ugc';
}

export default async function storyRawChatRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', {websocket: true}, (connection, req) => {
    connection.socket.on('message', (message: EventMessage) => {
      // Echo the received message back to the client
      connection.socket.send(`Server received: ${message}`);
    });
  });
}
