import {pgTable, uuid, text, integer} from 'drizzle-orm/pg-core';

export const storyIndex = pgTable('story_index', {
  storyId: uuid().primaryKey(),
  chunk: text().notNull(),
  vector: text().notNull(),
  metadata: text().notNull(),
  storyVersion: integer().notNull().default(1),
});
