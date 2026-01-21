import {pgTable, uuid, text, timestamp} from 'drizzle-orm/pg-core';
import {experienceTable, userTable} from './index.ts';

export const storyRawTable = pgTable('story_raw', {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid()
    .notNull()
    .references(() => userTable.id),
  experienceId: uuid().references(() => experienceTable.id),
  title: text(),
  tags: text().array().notNull().default([]),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export type StoryRaw = typeof storyRawTable.$inferSelect;
