import {relations} from 'drizzle-orm';
import {pgTable, uuid, text, timestamp, integer} from 'drizzle-orm/pg-core';
import {experienceTable} from './experience.ts';
import {userTable} from './user.ts';
import {storyRawEventTable} from './storyRawEvent.ts';

export const storyTable = pgTable('story_raw', {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid()
    .notNull()
    .references(() => userTable.id),
  experienceId: uuid().references(() => experienceTable.id),
  title: text(),
  content: text(),
  tags: text().array().notNull().default([]),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
  canonicalizedVersion: integer().notNull().default(0),
});

export type StoryRaw = typeof storyTable.$inferSelect;

export const storyRawRelations = relations(storyTable, ({one, many}) => ({
  experience: one(experienceTable, {
    fields: [storyTable.experienceId],
    references: [experienceTable.id],
  }),
  events: many(storyRawEventTable),
}));
