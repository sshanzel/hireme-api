import {pgTable, uuid, text, timestamp, integer} from 'drizzle-orm/pg-core';
import {userTable} from './user.ts';

export enum SourceType {
  Resume = 'resume',
  CoverLetter = 'cover_letter',
  Portfolio = 'portfolio',
  Notes = 'notes',
  Other = 'other',
}

export const fileTable = pgTable('file', {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid()
    .notNull()
    .references(() => userTable.id),
  sourceType: text().$type<SourceType>().notNull(),
  originalFileName: text().notNull(),
  mimeType: text().notNull(),
  gcsBucket: text().notNull(),
  gcsPath: text().notNull(),
  sizeInBytes: integer().notNull(),
  status: text().notNull(),
  tags: text().array().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export type File = typeof fileTable.$inferSelect;
