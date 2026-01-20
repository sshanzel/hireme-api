import {pgTable, uuid, text, timestamp, unique} from 'drizzle-orm/pg-core';
import {userTable} from './user.ts';

export const userParsedArchive = pgTable('user_parsed_archive', {
  userId: uuid()
    .primaryKey()
    .references(() => userTable.id),
  stringified: text().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export type UserParsedArchive = typeof userParsedArchive.$inferSelect;
