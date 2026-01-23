import {pgTable, uuid, text, timestamp, pgEnum, jsonb} from 'drizzle-orm/pg-core';
import {storyTable} from './story.ts';

export enum StoryEventRole {
  Assistant = 'assistant',
  User = 'user',
}

interface StoryEventMetadata {
  model: string;
  requestId: string;
  tokenUsage: number;
}

export const storyEventTable = pgTable('story_event', {
  id: uuid().defaultRandom().primaryKey(),
  storyId: uuid()
    .notNull()
    .references(() => storyTable.id),
  content: text().notNull(),
  role: text().$type<StoryEventRole>().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
  metadata: jsonb('metadata').$type<StoryEventMetadata>(),
});

export type StoryEvent = typeof storyEventTable.$inferSelect;
