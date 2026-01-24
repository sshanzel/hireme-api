import {relations} from 'drizzle-orm';
import {pgTable, uuid, text, timestamp} from 'drizzle-orm/pg-core';
import {userTable} from './user.ts';
import {storyTable} from './story.ts';

export enum ExperienceType {
  Work = 'work',
  Project = 'project',
  Education = 'education',
}

export const experienceTable = pgTable('experience', {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid()
    .notNull()
    .references(() => userTable.id),
  type: text().$type<ExperienceType>().notNull(),
  title: text().notNull(),
  organization: text(),
  startDate: timestamp().notNull(),
  endDate: timestamp(),
  description: text(),
  skills: text().array(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export type Experience = typeof experienceTable.$inferSelect;

export const experienceRelations = relations(experienceTable, ({one, many}) => ({
  stories: many(storyTable),
  user: one(userTable, {
    fields: [experienceTable.userId],
    references: [userTable.id],
  }),
}));
