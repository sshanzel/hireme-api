import {pgTable, uuid, text, integer, vector, jsonb} from 'drizzle-orm/pg-core';
import {experienceTable} from './experience.ts';

export const experienceIndexTable = pgTable('experience_index', {
  id: uuid().defaultRandom().primaryKey(),
  experienceId: uuid()
    .references(() => experienceTable.id)
    .notNull(),
  chunk: text().notNull(),
  vector: vector({dimensions: 1536}).notNull(),
  metadata: jsonb().notNull(),
  experienceVersion: integer().notNull().default(1),
});

export type ExperienceIndex = typeof experienceIndexTable.$inferSelect;
