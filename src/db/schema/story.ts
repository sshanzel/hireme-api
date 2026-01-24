import {relations} from 'drizzle-orm';
import {pgTable, uuid, text, timestamp, integer} from 'drizzle-orm/pg-core';
import {Experience, experienceTable} from './experience.ts';
import {userTable} from './user.ts';
import {StoryEvent, storyEventTable} from './storyEvent.ts';

export const storyTable = pgTable('story', {
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

export type Story = typeof storyTable.$inferSelect & {
  events?: StoryEvent[];
  experience?: Experience;
};

export const storyRelations = relations(storyTable, ({one, many}) => ({
  user: one(userTable, {
    fields: [storyTable.userId],
    references: [userTable.id],
  }),
  experience: one(experienceTable, {
    fields: [storyTable.experienceId],
    references: [experienceTable.id],
  }),
  events: many(storyEventTable),
}));
