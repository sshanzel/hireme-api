import {relations} from 'drizzle-orm';
import {pgTable, uuid, text, timestamp, unique} from 'drizzle-orm/pg-core';
import {document} from './document.ts';

export const users = pgTable(
  'user',
  {
    id: uuid().defaultRandom().primaryKey(),
    email: text().notNull(),
    displayName: text(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
  },
  t => [unique('users_email_unique').on(t.email)]
);

export const usersRelations = relations(users, ({many}) => ({
  documents: many(document),
}));
