import {pgTable, uuid, text, integer, vector, jsonb} from 'drizzle-orm/pg-core';
import {storyTable} from './index.ts';

export const storyIndexTable = pgTable('story_index', {
  id: uuid().defaultRandom().primaryKey(),
  storyId: uuid().references(() => storyTable.id),
  chunk: text().notNull(),
  vector: vector({dimensions: 1536}).notNull(),
  metadata: jsonb().notNull(),
  storyVersion: integer().notNull().default(1),
});

export type StoryIndex = typeof storyIndexTable.$inferSelect;
