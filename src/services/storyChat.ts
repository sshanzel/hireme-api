import type {WebSocket} from '@fastify/websocket';
import {generateResponse, type StoryResponse} from './storyTeller.ts';
import {
  createStoryEvent,
  deleteStory,
  getOrCreateStory,
  getStoryWithEvents,
  updateStory,
} from './story.ts';
import {StoryEventRole} from '../db/schema/storyEvent.ts';

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

interface IncomingChatMessage {
  type: IncomingMessageType.Chat;
  data: string;
}

interface IncomingLoadStoryMessage {
  type: IncomingMessageType.LoadStory;
  storyId: string;
}

type IncomingMessage = IncomingChatMessage | IncomingLoadStoryMessage;

interface StoryEvent {
  content: string;
  role: StoryEventRole;
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

interface OutgoingStoryLoadedMessage {
  type: OutgoingMessageType.StoryLoaded;
  story: StoryDataWithEvents;
}

type OutgoingMessage =
  | OutgoingConnectedMessage
  | OutgoingResponseMessage
  | OutgoingStoryLoadedMessage
  | OutgoingErrorMessage;

export class StoryChatSession {
  private socket: WebSocket;
  private userId: string;
  private story: StoryData;
  private events: StoryEvent[];

  private constructor(socket: WebSocket, userId: string, story: StoryData, events: StoryEvent[]) {
    this.socket = socket;
    this.userId = userId;
    this.story = story;
    this.events = events;
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

    if (parsed.type === IncomingMessageType.LoadStory) {
      if (typeof parsed.storyId !== 'string') {
        return {
          error: 'Invalid message format. Expected: {type: "load_story", storyId: string}',
        };
      }
      return {message: {type: IncomingMessageType.LoadStory, storyId: parsed.storyId}};
    }

    return {error: `Unknown message type: ${parsed.type}`};
  }

  private async saveEvent(content: string, role: StoryEventRole): Promise<void> {
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
      await this.saveEvent(response.content, StoryEventRole.Assistant);
    } catch (err) {
      console.error('Failed to save assistant response:', err);
    }

    const isNewConversation = this.events.filter(e => e.role === StoryEventRole.User).length === 1;
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

  private async handleLoadStory(storyId: string): Promise<void> {
    const result = await getStoryWithEvents(storyId, this.userId);

    if (!result) {
      this.sendError('Story not found', ErrorCode.NotFound);
      return;
    }

    const {story, events} = result;

    this.story = {id: story.id, title: story.title, tags: story.tags};
    this.events = events.map(({content, role, createdAt}) => ({content, role, createdAt}));

    this.send({
      type: OutgoingMessageType.StoryLoaded,
      story: this.getStoryData(),
    });
  }

  private async handleChat(content: string): Promise<void> {
    try {
      await this.saveEvent(content, StoryEventRole.User);
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
      case IncomingMessageType.LoadStory:
        await this.handleLoadStory(message.storyId);
        break;
    }
  }

  async cleanup(): Promise<void> {
    if (this.events.length > 0) {
      return;
    }

    const result = await getStoryWithEvents(this.story.id, this.userId);
    if (result && result.events.length === 0) {
      await deleteStory(this.story.id, this.userId);
    }
  }
}
