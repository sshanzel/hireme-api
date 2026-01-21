import {pgTable, uuid, text, timestamp, integer} from 'drizzle-orm/pg-core';
import {storyRawTable} from './storyRaw.ts';

export const storyTable = pgTable('story', {
  storyRawId: uuid()
    .notNull()
    .primaryKey()
    .references(() => storyRawTable.id),
  content: text().notNull(),
  title: text().notNull(),
  tags: text().array().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
  version: integer().notNull().default(1),
});

export type Story = typeof storyTable.$inferSelect;
