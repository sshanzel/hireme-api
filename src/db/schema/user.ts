import {relations} from 'drizzle-orm';
import {pgTable, uuid, text, timestamp, unique} from 'drizzle-orm/pg-core';
import {file} from './file.ts';

export const user = pgTable(
  'user',
  {
    id: uuid().defaultRandom().primaryKey(),
    email: text().notNull(),
    name: text().notNull(),
    passwordHash: text().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    cvUploadedAt: timestamp(),
  },
  t => [unique('users_email_unique').on(t.email)]
);

export const usersRelations = relations(user, ({many}) => ({
  files: many(file),
}));

export type User = typeof user.$inferSelect;
