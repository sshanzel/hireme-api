import {pgTable, uuid, text, timestamp, jsonb} from 'drizzle-orm/pg-core';
import {relations} from 'drizzle-orm';
import {coachingTable} from './coaching.ts';
import {MessageRole} from './types.ts';

export const coachingEventTable = pgTable('coaching_event', {
  id: uuid().defaultRandom().primaryKey(),
  coachingId: uuid()
    .notNull()
    .references(() => coachingTable.id),
  content: text().notNull(),
  role: text().$type<MessageRole>().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export const coachingEventRelations = relations(coachingEventTable, ({one}) => ({
  coaching: one(coachingTable, {
    fields: [coachingEventTable.coachingId],
    references: [coachingTable.id],
  }),
}));

export type CoachingEvent = typeof coachingEventTable.$inferSelect;
