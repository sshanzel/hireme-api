import {pgTable, uuid, text, timestamp} from 'drizzle-orm/pg-core';
import {storyRaw} from './storyRaw.ts';

export const storyRawEvent = pgTable('story_raw_event', {
  id: uuid().defaultRandom().primaryKey(),
  storyRawId: uuid()
    .notNull()
    .references(() => storyRaw.id),
  content: text().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});
