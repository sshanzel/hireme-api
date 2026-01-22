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

// Chat history item
interface ChatHistoryItem {
  content: string;
  role: StoryRawEventRole;
}

export class StoryChatSession {
  private socket: WebSocket;
  private userId: string;
  private storyId: string;
  private storyTitle: string | null;
  private storyTags: string[];
  private history: ChatHistoryItem[];
  private events: StoryEvent[];

  private constructor(
    socket: WebSocket,
    userId: string,
    storyId: string,
    storyTitle: string | null,
    storyTags: string[],
    history: ChatHistoryItem[],
    events: StoryEvent[]
  ) {
    this.socket = socket;
    this.userId = userId;
    this.storyId = storyId;
    this.storyTitle = storyTitle;
    this.storyTags = storyTags;
    this.history = history;
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
    const history = events.map(({content, role}) => ({content, role}));
    const storyEvents = events.map(({content, role, createdAt}) => ({
      content,
      role,
      createdAt,
    }));

    return new StoryChatSession(
      socket,
      userId,
      storyRaw.id,
      storyRaw.title,
      storyRaw.tags,
      history,
      storyEvents
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

  sendConnected(): void {
    this.send({
      type: OutgoingMessageType.Connected,
      story: {
        id: this.storyId,
        title: this.storyTitle,
        tags: this.storyTags,
        events: this.events,
      },
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
  private async saveMessage(content: string, role: StoryRawEventRole): Promise<void> {
    await createStoryRawEvent({
      userId: this.userId,
      content,
      role,
      storyRawId: this.storyId,
    });
    this.history.push({content, role});
  }

  private async generateAndSaveResponse(): Promise<StoryResponse> {
    const response = await generateResponse(this.history);

    // Save assistant response (non-blocking on failure)
    try {
      await this.saveMessage(response.content, StoryRawEventRole.Assistant);
    } catch (err) {
      console.error('Failed to save assistant response:', err);
    }

    // Update title/tags for new conversations (first user message)
    const isNewConversation =
      this.history.filter(m => m.role === StoryRawEventRole.User).length === 1;
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

  // Load story handler
  private async handleLoadStory(storyRawId: string): Promise<void> {
    const result = await getStoryRawWithEvents(storyRawId, this.userId);

    if (!result) {
      this.sendError('Story not found', ErrorCode.NotFound);
      return;
    }

    const {storyRaw, events} = result;

    // Update session state
    this.storyId = storyRaw.id;
    this.storyTitle = storyRaw.title;
    this.storyTags = storyRaw.tags;
    this.history = events.map(({content, role}) => ({content, role}));
    this.events = events.map(({content, role, createdAt}) => ({content, role, createdAt}));

    // Send story data to client
    this.send({
      type: OutgoingMessageType.StoryLoaded,
      story: {
        id: this.storyId,
        title: this.storyTitle,
        tags: this.storyTags,
        events: this.events,
      },
    });
  }

  // Chat handler
  private async handleChat(content: string): Promise<void> {
    try {
      await this.saveMessage(content, StoryRawEventRole.User);
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
    if (this.history.length > 0) {
      return;
    }

    const result = await getStoryRawWithEvents(this.storyId, this.userId);
    if (result && result.events.length === 0) {
      await deleteStoryRaw(this.storyId, this.userId);
    }
  }
}
