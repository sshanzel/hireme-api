import {pgTable, uuid, text, timestamp, integer} from 'drizzle-orm/pg-core';

export const story = pgTable('story', {
  id: uuid().defaultRandom().primaryKey(),
  storyRawId: uuid().notNull(),
  title: text().notNull(),
  tags: text().array().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
  version: integer().notNull().default(1),
});
