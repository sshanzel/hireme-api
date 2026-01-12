import {pgTable, uuid, text, timestamp, unique} from 'drizzle-orm/pg-core';

export const storyRaw = pgTable('story_raw', {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid().notNull(),
  experienceId: uuid().notNull(),
  title: text().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});
