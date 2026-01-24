import {pgTable, uuid, text, timestamp} from 'drizzle-orm/pg-core';
import {relations} from 'drizzle-orm';
import {profileChatTable} from './profileChat.ts';
import {MessageRole} from './types.ts';

export const profileChatEventTable = pgTable('profile_chat_event', {
  id: uuid().defaultRandom().primaryKey(),
  profileChatId: uuid()
    .notNull()
    .references(() => profileChatTable.id),
  content: text().notNull(),
  role: text().$type<MessageRole>().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export const profileChatEventRelations = relations(profileChatEventTable, ({one}) => ({
  profileChat: one(profileChatTable, {
    fields: [profileChatEventTable.profileChatId],
    references: [profileChatTable.id],
  }),
}));

export type ProfileChatEvent = typeof profileChatEventTable.$inferSelect;
