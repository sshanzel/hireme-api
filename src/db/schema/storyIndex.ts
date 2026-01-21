import {pgTable, uuid, text, integer} from 'drizzle-orm/pg-core';
import {storyTable} from './index.ts';

export const storyIndexTable = pgTable('story_index', {
  id: uuid().defaultRandom().primaryKey(),
  storyId: uuid().references(() => storyTable.storyRawId),
  chunk: text().notNull(),
  vector: text().notNull(),
  metadata: text().notNull(),
  storyVersion: integer().notNull().default(1),
});

export type StoryIndex = typeof storyIndexTable.$inferSelect;
