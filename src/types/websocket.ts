import type {WebSocket} from '@fastify/websocket';

export interface HeartbeatSocket extends WebSocket {
  isAlive: boolean;
}
