import {pgTable, uuid, text, timestamp, unique} from 'drizzle-orm/pg-core';

enum SourceType {
  Resume = 'resume',
  CoverLetter = 'cover_letter',
  Portfolio = 'portfolio',
  Notes = 'notes',
  Other = 'other',
}

export const document = pgTable('document', {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid().notNull(),
  sourceType: text().$type<SourceType>().notNull(),
  originalFileName: text().notNull(),
  mimeType: text().notNull(),
  gcsBucket: text().notNull(),
  gcsPath: text().notNull(),
  sizeInBytes: uuid().notNull(),
  contentSha256: text().notNull(),
  status: text().notNull(),
  tags: text().array().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});
