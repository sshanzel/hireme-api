import {pgTable, uuid, text, timestamp} from 'drizzle-orm/pg-core';

enum ExperienceType {
  Work = 'work',
  Project = 'project',
  Education = 'education',
}

export const experience = pgTable('experience', {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid().notNull(),
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
