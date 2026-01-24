import {relations} from 'drizzle-orm';
import {pgTable, uuid, text, timestamp} from 'drizzle-orm/pg-core';
import {userTable} from './user.ts';
import {ProfileChatEvent, profileChatEventTable} from './profileChatEvent.ts';

export const profileChatTable = pgTable('profile_chat', {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid()
    .notNull()
    .references(() => userTable.id),
  visitorIp: text().notNull(),
  origin: text(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export type ProfileChat = typeof profileChatTable.$inferSelect & {
  events?: ProfileChatEvent[];
};

export const profileChatRelations = relations(profileChatTable, ({one, many}) => ({
  user: one(userTable, {
    fields: [profileChatTable.userId],
    references: [userTable.id],
  }),
  events: many(profileChatEventTable),
}));
