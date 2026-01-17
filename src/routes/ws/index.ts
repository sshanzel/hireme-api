import {FastifyInstance} from 'fastify';

interface EventMessage {
  storyId?: string;
  content: string;
  type: 'ugc';
}

export default async function storyRawChatRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/story-event', {websocket: true}, (connection, req) => {
    // req.headers.origin;
    connection.on('message', (message: EventMessage) => {
      const parsed = JSON.parse(message.toString());
      // Echo the received message back to the client
      connection.send(JSON.stringify({type: 'message', data: `Server received: ${parsed.data}`}));
    });
  });
}
