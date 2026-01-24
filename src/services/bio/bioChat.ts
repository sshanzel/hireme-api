import type {WebSocket} from '@fastify/websocket';
import {generateProfileResponse, type ProfileResponse} from './generation.ts';
import {createProfileChatEvent, getOrCreateProfileChat, getUserById} from './bio.ts';

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
  RateLimited = 'RATE_LIMITED',
}

interface IncomingChatMessage {
  type: IncomingMessageType.Chat;
  data: string;
}

type IncomingMessage = IncomingChatMessage;

interface ProfileChatEventData {
  content: string;
  role: 'user' | 'assistant';
  createdAt: Date;
}

interface ProfileChatData {
  id: string;
  userName: string;
}

interface ProfileChatDataWithEvents extends ProfileChatData {
  events: ProfileChatEventData[];
}

interface OutgoingConnectedMessage {
  type: OutgoingMessageType.Connected;
  data: ProfileChatDataWithEvents;
}

interface OutgoingResponseMessage {
  type: OutgoingMessageType.Response;
  data: ProfileResponse;
}

interface OutgoingErrorMessage {
  type: OutgoingMessageType.Error;
  error: string;
  code: ErrorCode;
}

type OutgoingMessage = OutgoingConnectedMessage | OutgoingResponseMessage | OutgoingErrorMessage;

const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_MESSAGES_PER_WINDOW = 5;

export class BioChatSession {
  private socket: WebSocket;
  private userId: string;
  private userName: string;
  private profileChatId: string;
  private events: ProfileChatEventData[];
  private messageTimestamps: number[] = [];

  private constructor(
    socket: WebSocket,
    userId: string,
    userName: string,
    profileChatId: string,
    events: ProfileChatEventData[],
  ) {
    this.socket = socket;
    this.userId = userId;
    this.userName = userName;
    this.profileChatId = profileChatId;
    this.events = events;
  }

  static async create(
    socket: WebSocket,
    userId: string,
    visitorIp: string,
    origin?: string,
  ): Promise<BioChatSession | null> {
    const user = await getUserById(userId);

    if (!user) {
      return null;
    }

    const entity = await getOrCreateProfileChat(userId, visitorIp, origin);

    if (!entity) {
      return null;
    }

    const {profileChat, events} = entity;

    return new BioChatSession(
      socket,
      userId,
      user.name || 'this person',
      profileChat.id,
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

  private getProfileChatData(): ProfileChatDataWithEvents {
    return {
      id: this.profileChatId,
      userName: this.userName,
      events: this.events,
    };
  }

  sendConnected(): void {
    this.send({
      type: OutgoingMessageType.Connected,
      data: this.getProfileChatData(),
    });
  }

  private sendResponse(data: ProfileResponse): void {
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

  private isRateLimited(): boolean {
    const now = Date.now();
    this.messageTimestamps = this.messageTimestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);

    if (this.messageTimestamps.length >= MAX_MESSAGES_PER_WINDOW) {
      return true;
    }

    this.messageTimestamps.push(now);
    return false;
  }

  private async saveEvent(content: string, role: 'user' | 'assistant'): Promise<void> {
    const event = await createProfileChatEvent({
      profileChatId: this.profileChatId,
      content,
      role,
    });
    this.events.push({content, role, createdAt: event.createdAt});
  }

  private async generateAndSaveResponse(): Promise<ProfileResponse> {
    const response = await generateProfileResponse(this.events, this.userId, this.userName);

    try {
      await this.saveEvent(response.content, 'assistant');
    } catch (err) {
      console.error('Failed to save assistant response:', err);
    }

    return response;
  }

  private async handleChat(content: string): Promise<void> {
    if (this.isRateLimited()) {
      this.sendError('Too many messages. Please wait a moment.', ErrorCode.RateLimited);
      return;
    }

    try {
      await this.saveEvent(content, 'user');
    } catch (err) {
      console.error('Failed to save user message:', err);
      this.sendError('Failed to save message', ErrorCode.StorageError);
      return;
    }

    let response: ProfileResponse;
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
    // Keep the chat for analytics, don't delete
  }
}
