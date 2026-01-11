import {pgTable, uuid, text, timestamp, unique} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid().defaultRandom().primaryKey(),
    email: text().notNull(),
    displayName: text(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
  },
  t => [unique('users_email_unique').on(t.email)]
);
