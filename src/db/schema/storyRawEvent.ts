import {pgTable, uuid, text, timestamp, pgEnum, jsonb} from 'drizzle-orm/pg-core';
import {storyRaw} from './storyRaw.ts';

export enum StoryRawEventType {
  Assistant = 'assistant',
  User = 'user',
}

interface StoryRawEventMetadata {
  model: string;
  requestId: string;
  tokenUsage: number;
}

export const storyRawEvent = pgTable('story_raw_event', {
  id: uuid().defaultRandom().primaryKey(),
  storyRawId: uuid()
    .notNull()
    .references(() => storyRaw.id),
  content: text().notNull(),
  type: text().$type<StoryRawEventType>().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
  metadata: jsonb('metadata').$type<StoryRawEventMetadata>(),
});
