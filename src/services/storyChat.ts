import type {WebSocket} from '@fastify/websocket';
import {generateResponse, type StoryResponse} from './storyTeller.ts';
import {
  createStoryRawEvent,
  deleteStoryRaw,
  getOrCreateStoryRaw,
  getStoryRawWithEvents,
  updateStoryRaw,
} from './storyRaw.ts';
import {StoryRawEventRole} from '../db/schema/storyRawEvent.ts';

// Message types
export enum IncomingMessageType {
  Chat = 'chat',
  LoadStory = 'load_story',
}

export enum OutgoingMessageType {
  Connected = 'connected',
  Response = 'response',
  StoryLoaded = 'story_loaded',
  Error = 'error',
}

export enum ErrorCode {
  InvalidMessage = 'INVALID_MESSAGE',
  ParseError = 'PARSE_ERROR',
  GenerationError = 'GENERATION_ERROR',
  StorageError = 'STORAGE_ERROR',
  NotFound = 'NOT_FOUND',
}

// Message interfaces
interface IncomingChatMessage {
  type: IncomingMessageType.Chat;
  data: string;
}

interface IncomingLoadStoryMessage {
  type: IncomingMessageType.LoadStory;
  storyRawId: string;
}

type IncomingMessage = IncomingChatMessage | IncomingLoadStoryMessage;

interface StoryEvent {
  content: string;
  role: StoryRawEventRole;
  createdAt: Date;
}

interface StoryRawData {
  id: string;
  title: string | null;
  tags: string[] | null;
}

interface StoryData {
  id: string;
  title: string | null;
  tags: string[] | null;
  events: StoryEvent[];
}

interface OutgoingConnectedMessage {
  type: OutgoingMessageType.Connected;
  story: StoryData;
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

interface OutgoingStoryLoadedMessage {
  type: OutgoingMessageType.StoryLoaded;
  story: StoryData;
}

type OutgoingMessage =
  | OutgoingConnectedMessage
  | OutgoingResponseMessage
  | OutgoingStoryLoadedMessage
  | OutgoingErrorMessage;

export class StoryChatSession {
  private socket: WebSocket;
  private userId: string;
  private storyRaw: StoryRawData;
  private events: StoryEvent[];

  private constructor(
    socket: WebSocket,
    userId: string,
    storyRaw: StoryRawData,
    events: StoryEvent[]
  ) {
    this.socket = socket;
    this.userId = userId;
    this.storyRaw = storyRaw;
    this.events = events;
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

    return new StoryChatSession(
      socket,
      userId,
      {id: storyRaw.id, title: storyRaw.title, tags: storyRaw.tags},
      events.map(({content, role, createdAt}) => ({content, role, createdAt}))
    );
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

  private getStoryData(): StoryData {
    return {
      id: this.storyRaw.id,
      title: this.storyRaw.title,
      tags: this.storyRaw.tags,
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

  // Message parsing
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

    if (parsed.type === IncomingMessageType.LoadStory) {
      if (typeof parsed.storyRawId !== 'string') {
        return {
          error: 'Invalid message format. Expected: {type: "load_story", storyRawId: string}',
        };
      }
      return {message: {type: IncomingMessageType.LoadStory, storyRawId: parsed.storyRawId}};
    }

    return {error: `Unknown message type: ${parsed.type}`};
  }

  // Chat operations
  private async saveEvent(content: string, role: StoryRawEventRole): Promise<void> {
    const {event} = await createStoryRawEvent({
      userId: this.userId,
      content,
      role,
      storyRawId: this.storyRaw.id,
    });
    this.events.push({content, role, createdAt: event.createdAt});
  }

  private async generateAndSaveResponse(): Promise<StoryResponse> {
    const response = await generateResponse(this.events);

    // Save assistant response (non-blocking on failure)
    try {
      await this.saveEvent(response.content, StoryRawEventRole.Assistant);
    } catch (err) {
      console.error('Failed to save assistant response:', err);
    }

    // Update title/tags for new conversations (first user message)
    const isNewConversation =
      this.events.filter(e => e.role === StoryRawEventRole.User).length === 1;
    if (isNewConversation && (response.title || response.tags)) {
      try {
        await updateStoryRaw(this.storyRaw.id, this.userId, {
          title: response.title ?? undefined,
          tags: response.tags ?? undefined,
        });
        // Update local state
        if (response.title) this.storyRaw.title = response.title;
        if (response.tags) this.storyRaw.tags = response.tags;
      } catch (err) {
        console.error('Failed to update story metadata:', err);
      }
    }

    return response;
  }

  // Load story handler
  private async handleLoadStory(storyRawId: string): Promise<void> {
    const result = await getStoryRawWithEvents(storyRawId, this.userId);

    if (!result) {
      this.sendError('Story not found', ErrorCode.NotFound);
      return;
    }

    const {storyRaw, events} = result;

    // Update session state
    this.storyRaw = {id: storyRaw.id, title: storyRaw.title, tags: storyRaw.tags};
    this.events = events.map(({content, role, createdAt}) => ({content, role, createdAt}));

    // Send story data to client
    this.send({
      type: OutgoingMessageType.StoryLoaded,
      story: this.getStoryData(),
    });
  }

  // Chat handler
  private async handleChat(content: string): Promise<void> {
    try {
      await this.saveEvent(content, StoryRawEventRole.User);
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

  // Main message handler
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
      case IncomingMessageType.LoadStory:
        await this.handleLoadStory(message.storyRawId);
        break;
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    if (this.events.length > 0) {
      return;
    }

    const result = await getStoryRawWithEvents(this.storyRaw.id, this.userId);
    if (result && result.events.length === 0) {
      await deleteStoryRaw(this.storyRaw.id, this.userId);
    }
  }
}
