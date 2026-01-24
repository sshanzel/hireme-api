import type {WebSocket} from '@fastify/websocket';
import {generateCoachResponse, type CoachResponse} from './coach.ts';
import {
  createCoachingEvent,
  deleteCoaching,
  getOrCreateCoaching,
  updateCoaching,
} from './coaching.ts';

export enum IncomingMessageType {
  Chat = 'chat',
}

export enum OutgoingMessageType {
  Connected = 'connected',
  Response = 'response',
  Error = 'error',
}

export enum ErrorCode {
  InvalidMessage = 'INVALID_MESSAGE',
  ParseError = 'PARSE_ERROR',
  GenerationError = 'GENERATION_ERROR',
  StorageError = 'STORAGE_ERROR',
  NotFound = 'NOT_FOUND',
}

interface IncomingChatMessage {
  type: IncomingMessageType.Chat;
  data: string;
}

type IncomingMessage = IncomingChatMessage;

interface CoachingEventData {
  content: string;
  role: 'user' | 'assistant';
  createdAt: Date;
}

interface CoachingData {
  id: string;
  title: string | null;
}

interface CoachingDataWithEvents extends CoachingData {
  events: CoachingEventData[];
}

interface OutgoingConnectedMessage {
  type: OutgoingMessageType.Connected;
  coaching: CoachingDataWithEvents;
}

interface OutgoingResponseMessage {
  type: OutgoingMessageType.Response;
  data: CoachResponse;
}

interface OutgoingErrorMessage {
  type: OutgoingMessageType.Error;
  error: string;
  code: ErrorCode;
}

type OutgoingMessage = OutgoingConnectedMessage | OutgoingResponseMessage | OutgoingErrorMessage;

export class CoachChatSession {
  private socket: WebSocket;
  private userId: string;
  private coaching: CoachingData;
  private events: CoachingEventData[];
  private initialSize: number;

  private constructor(
    socket: WebSocket,
    userId: string,
    coaching: CoachingData,
    events: CoachingEventData[],
  ) {
    this.socket = socket;
    this.userId = userId;
    this.coaching = coaching;
    this.events = events;
    this.initialSize = events.length;
  }

  static async create(
    socket: WebSocket,
    userId: string,
    coachingId?: string,
  ): Promise<CoachChatSession | null> {
    const entity = await getOrCreateCoaching(userId, coachingId);

    if (!entity) {
      return null;
    }

    const {coaching, events} = entity;

    return new CoachChatSession(
      socket,
      userId,
      {id: coaching.id, title: coaching.title},
      events.map(({content, role, createdAt}) => ({
        content,
        role: role as 'user' | 'assistant',
        createdAt,
      })),
    );
  }

  private send(message: OutgoingMessage): void {
    if (this.socket.readyState !== this.socket.OPEN) {
      return;
    }
    this.socket.send(JSON.stringify(message));
  }

  private sendError(error: string, code: ErrorCode): void {
    this.send({type: OutgoingMessageType.Error, error, code});
  }

  private getCoachingData(): CoachingDataWithEvents {
    return {
      id: this.coaching.id,
      title: this.coaching.title,
      events: this.events,
    };
  }

  sendConnected(): void {
    this.send({
      type: OutgoingMessageType.Connected,
      coaching: this.getCoachingData(),
    });
  }

  private sendResponse(data: CoachResponse): void {
    this.send({type: OutgoingMessageType.Response, data});
  }

  private parseMessage(raw: string): {message?: IncomingMessage; error?: string} {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {error: 'Invalid JSON'};
    }

    if (!parsed.type) {
      return {error: 'Missing message type'};
    }

    if (parsed.type === IncomingMessageType.Chat) {
      if (typeof parsed.data !== 'string') {
        return {error: 'Invalid message format'};
      }
      const content = parsed.data.trim();
      if (!content) {
        return {error: 'Message content cannot be empty'};
      }
      return {message: {type: IncomingMessageType.Chat, data: content}};
    }

    return {error: `Unknown message type: ${parsed.type}`};
  }

  private async saveEvent(content: string, role: 'user' | 'assistant'): Promise<void> {
    const event = await createCoachingEvent({
      coachingId: this.coaching.id,
      content,
      role,
    });
    this.events.push({content, role, createdAt: event.createdAt});
  }

  private async generateAndSaveResponse(): Promise<CoachResponse> {
    const response = await generateCoachResponse(this.events, this.userId);

    try {
      await this.saveEvent(response.content, 'assistant');
    } catch (err) {
      console.error('Failed to save assistant response:', err);
    }

    const isNewConversation = this.events.filter(e => e.role === 'user').length === 1;
    if (isNewConversation && response.title) {
      try {
        await updateCoaching(this.coaching.id, this.userId, response.title);
        this.coaching.title = response.title;
      } catch (err) {
        console.error('Failed to update coaching title:', err);
      }
    }

    return response;
  }

  private async handleChat(content: string): Promise<void> {
    try {
      await this.saveEvent(content, 'user');
    } catch (err) {
      console.error('Failed to save user message:', err);
      this.sendError('Failed to save message', ErrorCode.StorageError);
      return;
    }

    let response: CoachResponse;
    try {
      response = await this.generateAndSaveResponse();
    } catch (err) {
      console.error('Failed to generate response:', err);
      this.sendError('Failed to generate response', ErrorCode.GenerationError);
      return;
    }

    this.sendResponse(response);
  }

  async handleMessage(rawMessage: string): Promise<void> {
    const {message, error: parseError} = this.parseMessage(rawMessage);

    if (parseError || !message) {
      this.sendError(parseError || 'Invalid message', ErrorCode.ParseError);
      return;
    }

    switch (message.type) {
      case IncomingMessageType.Chat:
        await this.handleChat(message.data);
        break;
    }
  }

  async cleanup(): Promise<void> {
    if (this.events.length === 0) {
      await deleteCoaching(this.coaching.id, this.userId);
    }
  }
}
