import {relations} from 'drizzle-orm';
import {pgTable, uuid, text, timestamp} from 'drizzle-orm/pg-core';
import {experienceTable} from './experience.ts';
import {userTable} from './user.ts';
import {storyRawEventTable} from './storyRawEvent.ts';

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

export const storyRawRelations = relations(storyRawTable, ({one, many}) => ({
  experience: one(experienceTable, {
    fields: [storyRawTable.experienceId],
    references: [experienceTable.id],
  }),
  events: many(storyRawEventTable),
}));
