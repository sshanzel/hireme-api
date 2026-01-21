import type {WebSocket} from '@fastify/websocket';
import {generateResponse, type StoryResponse} from './storyTeller.ts';
import {
  createStoryRawEvent,
  deleteStoryRaw,
  getOrCreateStoryRaw,
  getStoryRawWithEvents,
  updateStoryRaw,
} from './storyRaw.ts';
import {StoryRawEventType} from '../db/schema/storyRawEvent.ts';

// Message types
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
}

// Message interfaces
interface IncomingChatMessage {
  type: IncomingMessageType.Chat;
  data: string;
}

type IncomingMessage = IncomingChatMessage;

interface OutgoingConnectedMessage {
  type: OutgoingMessageType.Connected;
  storyId: string;
}

interface OutgoingResponseMessage {
  type: OutgoingMessageType.Response;
  data: StoryResponse;
}

interface OutgoingErrorMessage {
  type: OutgoingMessageType.Error;
  error: string;
  code: ErrorCode;
}

type OutgoingMessage = OutgoingConnectedMessage | OutgoingResponseMessage | OutgoingErrorMessage;

// Chat history item
interface ChatHistoryItem {
  content: string;
  type: StoryRawEventType;
}

export class StoryChatSession {
  private socket: WebSocket;
  private userId: string;
  private storyId: string;
  private history: ChatHistoryItem[];

  private constructor(
    socket: WebSocket,
    userId: string,
    storyId: string,
    history: ChatHistoryItem[]
  ) {
    this.socket = socket;
    this.userId = userId;
    this.storyId = storyId;
    this.history = history;
  }

  static async create(
    socket: WebSocket,
    userId: string,
    storyId?: string
  ): Promise<StoryChatSession | null> {
    const entity = await getOrCreateStoryRaw(userId, storyId);

    if (!entity) {
      return null;
    }

    const {storyRaw, events} = entity;
    const history = events.map(({content, type}) => ({content, type}));

    return new StoryChatSession(socket, userId, storyRaw.id, history);
  }

  // Socket communication
  private send(message: OutgoingMessage): void {
    if (this.socket.readyState !== this.socket.OPEN) {
      return;
    }
    this.socket.send(JSON.stringify(message));
  }

  private sendError(error: string, code: ErrorCode): void {
    this.send({type: OutgoingMessageType.Error, error, code});
  }

  sendConnected(): void {
    this.send({
      type: OutgoingMessageType.Connected,
      storyId: this.storyId,
    });
  }

  private sendResponse(data: StoryResponse): void {
    this.send({type: OutgoingMessageType.Response, data});
  }

  // Message parsing
  private parseMessage(raw: string): {message?: IncomingMessage; error?: string} {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {error: 'Invalid JSON'};
    }

    if (
      !parsed.type ||
      parsed.type !== IncomingMessageType.Chat ||
      typeof parsed.data !== 'string'
    ) {
      return {error: 'Invalid message format. Expected: {type: "chat", data: string}'};
    }

    const content = parsed.data.trim();
    if (!content) {
      return {error: 'Message content cannot be empty'};
    }

    return {message: {type: IncomingMessageType.Chat, data: content}};
  }

  // Chat operations
  private async saveMessage(content: string, type: StoryRawEventType): Promise<void> {
    await createStoryRawEvent({
      userId: this.userId,
      content,
      type,
      storyRawId: this.storyId,
    });
    this.history.push({content, type});
  }

  private async generateAndSaveResponse(): Promise<StoryResponse> {
    const response = await generateResponse(this.history);

    // Save assistant response (non-blocking on failure)
    try {
      await this.saveMessage(response.content, StoryRawEventType.Assistant);
    } catch (err) {
      console.error('Failed to save assistant response:', err);
    }

    // Update title/tags for new conversations (first user message)
    const isNewConversation =
      this.history.filter(m => m.type === StoryRawEventType.User).length === 1;
    if (isNewConversation && (response.title || response.tags)) {
      try {
        await updateStoryRaw(this.storyId, this.userId, {
          title: response.title ?? undefined,
          tags: response.tags ?? undefined,
        });
      } catch (err) {
        console.error('Failed to update story metadata:', err);
      }
    }

    return response;
  }

  // Main message handler
  async handleMessage(rawMessage: string): Promise<void> {
    const {message, error: parseError} = this.parseMessage(rawMessage);

    if (parseError || !message) {
      this.sendError(parseError || 'Invalid message', ErrorCode.ParseError);
      return;
    }

    try {
      await this.saveMessage(message.data, StoryRawEventType.User);
    } catch (err) {
      console.error('Failed to save user message:', err);
      this.sendError('Failed to save message', ErrorCode.StorageError);
      return;
    }

    let response: StoryResponse;
    try {
      response = await this.generateAndSaveResponse();
    } catch (err) {
      console.error('Failed to generate response:', err);
      this.sendError('Failed to generate response', ErrorCode.GenerationError);
      return;
    }

    this.sendResponse(response);
  }

  // Cleanup
  async cleanup(): Promise<void> {
    if (this.history.length > 0) {
      return;
    }

    const result = await getStoryRawWithEvents(this.storyId, this.userId);
    if (result && result.events.length === 0) {
      await deleteStoryRaw(this.storyId, this.userId);
    }
  }
}
