import {pgTable, uuid, text, integer} from 'drizzle-orm/pg-core';
import {story} from './index.ts';

export const storyIndex = pgTable('story_index', {
  storyId: uuid()
    .primaryKey()
    .references(() => story.id),
  chunk: text().notNull(),
  vector: text().notNull(),
  metadata: text().notNull(),
  storyVersion: integer().notNull().default(1),
});
