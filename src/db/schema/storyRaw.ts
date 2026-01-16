import {pgTable, uuid, text, timestamp} from 'drizzle-orm/pg-core';
import {experience, user} from './index.ts';

export const storyRaw = pgTable('story_raw', {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid()
    .notNull()
    .references(() => user.id),
  experienceId: uuid().references(() => experience.id),
  title: text(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});
