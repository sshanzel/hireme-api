import {relations} from 'drizzle-orm';
import {pgTable, uuid, text, timestamp, unique} from 'drizzle-orm/pg-core';
import {fileTable} from './file.ts';
import {experienceTable} from './experience.ts';
import {storyTable} from './story.ts';

export const userTable = pgTable(
  'user',
  {
    id: uuid().defaultRandom().primaryKey(),
    email: text().notNull(),
    username: text(),
    name: text().notNull(),
    passwordHash: text().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    cvUploadedAt: timestamp(),
    links: text().array().notNull().default([]),
    summary: text(),
    headline: text(),
  },
  t => [unique('users_email_unique').on(t.email), unique('users_username_unique').on(t.username)],
);

export const usersRelations = relations(userTable, ({many}) => ({
  files: many(fileTable),
  experiences: many(experienceTable),
  stories: many(storyTable),
}));

export type User = typeof userTable.$inferSelect;
