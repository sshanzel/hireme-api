import {pgTable, uuid, text, timestamp, pgEnum} from 'drizzle-orm/pg-core';
import {storyRaw} from './storyRaw.ts';

export enum StoryRawEventType {
  System = 'system',
  User = 'user',
}

export const typeEnum = pgEnum('story_raw_event_type', [
  StoryRawEventType.System,
  StoryRawEventType.User,
]);

export const storyRawEvent = pgTable('story_raw_event', {
  id: uuid().defaultRandom().primaryKey(),
  storyRawId: uuid()
    .notNull()
    .references(() => storyRaw.id),
  content: text().notNull(),
  type: typeEnum().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});
