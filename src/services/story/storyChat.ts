import type {WebSocket} from '@fastify/websocket';
import {generateResponse, type StoryResponse} from './storyTeller.ts';
import {
  createStoryEvent,
  deleteStory,
  getOrCreateStory,
  getStoryById,
  getStoryWithEvents,
  updateStory,
} from './story.ts';
import type {MessageRole} from '../../db/schema/types.ts';
import {publish} from '../pubsub.ts';

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

interface StoryEvent {
  content: string;
  role: MessageRole;
  createdAt: Date;
}

interface StoryData {
  id: string;
  title: string | null;
  tags: string[] | null;
}

interface StoryDataWithEvents {
  id: string;
  title: string | null;
  tags: string[] | null;
  events: StoryEvent[];
}

interface OutgoingConnectedMessage {
  type: OutgoingMessageType.Connected;
  story: StoryDataWithEvents;
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

export class StoryChatSession {
  private socket: WebSocket;
  private userId: string;
  private story: StoryData;
  private events: StoryEvent[];
  private initialSize: number;

  private constructor(socket: WebSocket, userId: string, story: StoryData, events: StoryEvent[]) {
    this.socket = socket;
    this.userId = userId;
    this.story = story;
    this.events = events;
    this.initialSize = events.length;
  }

  static async create(
    socket: WebSocket,
    userId: string,
    storyId?: string,
  ): Promise<StoryChatSession | null> {
    const entity = await getOrCreateStory(userId, storyId);

    if (!entity) {
      return null;
    }

    const {story, events} = entity;

    return new StoryChatSession(
      socket,
      userId,
      {id: story.id, title: story.title, tags: story.tags},
      events.map(({content, role, createdAt}) => ({content, role, createdAt})),
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

  private getStoryData(): StoryDataWithEvents {
    return {
      id: this.story.id,
      title: this.story.title,
      tags: this.story.tags,
      events: this.events,
    };
  }

  sendConnected(): void {
    this.send({
      type: OutgoingMessageType.Connected,
      story: this.getStoryData(),
    });
  }

  private sendResponse(data: StoryResponse): void {
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
        return {error: 'Invalid message format. Expected: {type: "chat", data: string}'};
      }
      const content = parsed.data.trim();
      if (!content) {
        return {error: 'Message content cannot be empty'};
      }
      return {message: {type: IncomingMessageType.Chat, data: content}};
    }

    return {error: `Unknown message type: ${parsed.type}`};
  }

  private async saveEvent(content: string, role: MessageRole): Promise<void> {
    const {event} = await createStoryEvent({
      userId: this.userId,
      content,
      role,
      storyId: this.story.id,
    });
    this.events.push({content, role, createdAt: event.createdAt});
  }

  private async generateAndSaveResponse(): Promise<StoryResponse> {
    const response = await generateResponse(this.events);

    try {
      await this.saveEvent(response.content, 'assistant');
    } catch (err) {
      console.error('Failed to save assistant response:', err);
    }

    const isNewConversation = this.events.filter(e => e.role === 'user').length === 1;
    if (isNewConversation && (response.title || response.tags)) {
      try {
        await updateStory(this.story.id, this.userId, {
          title: response.title ?? undefined,
          tags: response.tags ?? undefined,
        });

        if (response.title) this.story.title = response.title;
        if (response.tags) this.story.tags = response.tags;
      } catch (err) {
        console.error('Failed to update story metadata:', err);
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
      await deleteStory(this.story.id, this.userId);
      return;
    }

    if (this.events.length === this.initialSize) {
      return;
    }

    await publish('api.v1.story-completed', {storyId: this.story.id});
  }
}
