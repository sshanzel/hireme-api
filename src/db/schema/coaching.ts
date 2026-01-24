import {relations} from 'drizzle-orm';
import {pgTable, uuid, text, timestamp} from 'drizzle-orm/pg-core';
import {Experience} from './experience.ts';
import {userTable} from './user.ts';
import {CoachingEvent, coachingEventTable} from './coachingEvent.ts';

export const coachingTable = pgTable('coaching', {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid()
    .notNull()
    .references(() => userTable.id),
  title: text(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export type Coaching = typeof coachingTable.$inferSelect & {
  events?: CoachingEvent[];
  experience?: Experience;
};

export const coachingRelations = relations(coachingTable, ({many}) => ({
  events: many(coachingEventTable),
}));
