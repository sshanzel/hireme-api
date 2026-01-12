import {pgTable, uuid, text, timestamp, integer} from 'drizzle-orm/pg-core';
import {storyRaw} from './storyRaw.ts';

export const story = pgTable('story', {
  id: uuid().defaultRandom().primaryKey(),
  storyRawId: uuid()
    .notNull()
    .references(() => storyRaw.id),
  title: text().notNull(),
  tags: text().array().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
  version: integer().notNull().default(1),
});
