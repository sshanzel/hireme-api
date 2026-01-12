import {pgTable, uuid, text, timestamp} from 'drizzle-orm/pg-core';
import {user} from './user.ts';

enum SourceType {
  Resume = 'resume',
  CoverLetter = 'cover_letter',
  Portfolio = 'portfolio',
  Notes = 'notes',
  Other = 'other',
}

export const file = pgTable('file', {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid()
    .notNull()
    .references(() => user.id),
  sourceType: text().$type<SourceType>().notNull(),
  originalFileName: text().notNull(),
  mimeType: text().notNull(),
  gcsBucket: text().notNull(),
  gcsPath: text().notNull(),
  sizeInBytes: uuid().notNull(),
  status: text().notNull(),
  tags: text().array().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});
